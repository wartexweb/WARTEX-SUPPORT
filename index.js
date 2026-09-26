require("dotenv").config();

const http = require("http");

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

// ======================================================
// WARTEX SUPPORT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TICKET_PANEL_CHANNEL_ID =
  process.env.TICKET_PANEL_CHANNEL_ID;
const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID;
const SUPPORT_ROLE_ID =
  process.env.SUPPORT_ROLE_ID;

const PORT = process.env.PORT || 10000;

// ======================================================
// TICKET TOPICS
// ======================================================

const ticketTopics = {
  purchase: {
    emoji: "🛒",
    name: "PRODUCT PURCHASE",
    description:
      "Product purchases, pricing, availability, orders and purchase assistance."
  },

  returns: {
    emoji: "🔄",
    name: "RETURNS & PRODUCT ISSUES",
    description:
      "Returns, product problems, missing features and order issues."
  },

  partnership: {
    emoji: "🤝",
    name: "PARTNERSHIPS & ADVERTISING",
    description:
      "Partnerships, advertising, promotions and collaborations."
  },

  support: {
    emoji: "🆘",
    name: "GENERAL SUPPORT",
    description:
      "General questions, technical assistance and server-related issues."
  }
};

// ======================================================
// RENDER HEALTH SERVER
// ======================================================

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        status: "online",
        bot: client.user?.tag || null,
        ready: client.isReady()
      })
    );

    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("WARTEX SUPPORT ONLINE");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ======================================================
// BOT READY
// ======================================================

client.once("ready", async () => {
  console.log("================================");
  console.log("🟢 WARTEX SUPPORT ONLINE");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🎫 Ticket System: ONLINE");
  console.log("🌐 Health Server: ONLINE");
  console.log("================================");

  client.user.setPresence({
    activities: [
      {
        name: "WARTEX SUPPORT",
        type: 3
      }
    ],
    status: "online"
  });

  await createTicketPanel();
});

// ======================================================
// CREATE TICKET PANEL
// ======================================================

async function createTicketPanel() {
  if (
    !GUILD_ID ||
    !TICKET_PANEL_CHANNEL_ID
  ) {
    console.log(
      "❌ GUILD_ID veya TICKET_PANEL_CHANNEL_ID eksik."
    );
    return;
  }

  const guild = await client.guilds
    .fetch(GUILD_ID)
    .catch(() => null);

  if (!guild) {
    console.log("❌ Sunucu bulunamadı.");
    return;
  }

  const channel = await guild.channels
    .fetch(TICKET_PANEL_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.log(
      "❌ Ticket panel kanalı bulunamadı."
    );
    return;
  }

  // Daha önce panel oluşturulduysa tekrar oluşturma
  const messages = await channel.messages
    .fetch({ limit: 50 })
    .catch(() => null);

  const existingPanel = messages?.find(
    message =>
      message.author.id === client.user.id &&
      message.components.some(row =>
        row.components.some(
          component =>
            component.customId ===
            "wartex_ticket_select"
        )
      )
  );

  if (existingPanel) {
    console.log(
      "ℹ️ Ticket paneli zaten mevcut."
    );
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("wartex_ticket_select")
    .setPlaceholder(
      "Select a ticket topic / Ticket konusu seç"
    )
    .addOptions(
      Object.entries(ticketTopics).map(
        ([value, topic]) => ({
          label: topic.name,
          description: topic.description,
          value,
          emoji: topic.emoji
        })
      )
    );

  const row = new ActionRowBuilder()
    .addComponents(menu);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎫 WARTEX SUPPORT")
    .setDescription(
      [
        "🇬🇧 **Need help? Select a ticket topic below.**",
        "",
        "🛒 **PRODUCT PURCHASE**",
        "For purchases, pricing, availability and orders.",
        "",
        "🔄 **RETURNS & PRODUCT ISSUES**",
        "For returns, product problems and order issues.",
        "",
        "🤝 **PARTNERSHIPS & ADVERTISING**",
        "For partnerships, advertising and collaborations.",
        "",
        "🆘 **GENERAL SUPPORT**",
        "For general questions and technical assistance.",
        "",
        "🇹🇷 **Yardıma mı ihtiyacın var? Aşağıdan ticket konusunu seç.**",
        "",
        "⚠️ **Please do not spam tickets.**",
        "⚠️ **Lütfen ticketları spamlamayın.**"
      ].join("\n")
    )
    .setFooter({
      text: "WARTEX SUPPORT"
    });

  await channel.send({
    embeds: [embed],
    components: [row]
  });

  console.log(
    "✅ Ticket paneli oluşturuldu."
  );
}

// ======================================================
// CREATE TICKET
// ======================================================

async function createTicket(interaction, topicKey) {
  const guild = interaction.guild;
  const user = interaction.user;
  const topic = ticketTopics[topicKey];

  if (!topic) {
    return interaction.reply({
      content:
        "❌ Invalid ticket topic.",
      ephemeral: true
    });
  }

  // Kullanıcının açık ticketı var mı?
  const existingTicket =
    guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic ===
          `WARTEX_TICKET:${user.id}`
    );

  if (existingTicket) {
    return interaction.reply({
      content:
        `❌ You already have an open ticket.\n\n${existingTicket}`,
      ephemeral: true
    });
  }

  await interaction.deferReply({
    ephemeral: true
  });

  // ====================================================
  // PERMISSIONS
  // ====================================================

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id: user.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },

    {
      id: client.user.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  // Yetkili rolünü ekle
  if (SUPPORT_ROLE_ID) {
    permissionOverwrites.push({
      id: SUPPORT_ROLE_ID,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  }

  // ====================================================
  // CREATE CHANNEL
  // ====================================================

  const safeUsername = user.username
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 70);

  const channelName =
    `${topic.emoji}-${safeUsername}`
      .slice(0, 95);

  const ticketChannel =
    await guild.channels.create({
      name: channelName,

      type: ChannelType.GuildText,

      topic:
        `WARTEX_TICKET:${user.id}`,

      parent:
        TICKET_CATEGORY_ID || undefined,

      permissionOverwrites
    });

  // ====================================================
  // TICKET MESSAGE
  // ====================================================

  const ticketEmbed =
    new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(
        `${topic.emoji} ${topic.name}`
      )
      .setDescription(
        [
          `👤 **User / Kullanıcı:** ${user}`,
          "",
          `📂 **Ticket Topic / Ticket Konusu:**`,
          `**${topic.name}**`,
          "",
          "🇬🇧 **Welcome to WARTEX SUPPORT!**",
          "",
          "Your private support ticket has been created.",
          "Please describe your problem or request clearly.",
          "A support staff member will assist you as soon as possible.",
          "",
          "⏳ **Please wait for a staff member.**",
          "",
          "⚠️ **Do not spam this ticket.**",
          "Send only information related to your request.",
          "",
          "🇹🇷 **WARTEX SUPPORT'a hoş geldin!**",
          "",
          "Özel destek ticketın oluşturuldu.",
          "Sorununu veya talebini açıkça belirt.",
          "Bir destek yetkilisinin yanıt vermesini bekle.",
          "",
          "⏳ **Lütfen yetkilinin yanıtını bekle.**",
          "",
          "⚠️ **Ticketı spamlamayın.**",
          "Sadece talebinizle ilgili mesajlar gönderin."
        ].join("\n")
      )
      .setFooter({
        text:
          "WARTEX SUPPORT • Please wait for assistance"
      })
      .setTimestamp();

  const closeButton =
    new ButtonBuilder()
      .setCustomId(
        "wartex_close_ticket"
      )
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(
        ButtonStyle.Danger
      );

  const buttonRow =
    new ActionRowBuilder()
      .addComponents(
        closeButton
      );

  await ticketChannel.send({
    content:
      `${user}${
        SUPPORT_ROLE_ID
          ? ` <@&${SUPPORT_ROLE_ID}>`
          : ""
      }`,

    embeds: [
      ticketEmbed
    ],

    components: [
      buttonRow
    ]
  });

  await interaction.editReply({
    content:
      `✅ **Ticket created successfully!**\n\n${ticketChannel}`
  });

  console.log(
    `🎫 Ticket: ${ticketChannel.name} | ${user.tag} | ${topic.name}`
  );
}

// ======================================================
// CLOSE TICKET
// ======================================================

async function closeTicket(interaction) {
  const channel =
    interaction.channel;

  if (
    !channel?.topic?.startsWith(
      "WARTEX_TICKET:"
    )
  ) {
    return interaction.reply({
      content:
        "❌ This is not a WARTEX ticket.",
      ephemeral: true
    });
  }

  const ownerId =
    channel.topic.split(":")[1];

  const isOwner =
    interaction.user.id ===
    ownerId;

  const isStaff =
    SUPPORT_ROLE_ID &&
    interaction.member.roles.cache.has(
      SUPPORT_ROLE_ID
    );

  if (!isOwner && !isStaff) {
    return interaction.reply({
      content:
        "❌ You cannot close this ticket.",
      ephemeral: true
    });
  }

  await interaction.reply({
    content:
      "🔒 Ticket closed. This channel will be deleted in 5 seconds."
  });

  setTimeout(() => {
    channel
      .delete(
        "WARTEX SUPPORT - Ticket Closed"
      )
      .catch(() => {});
  }, 5000);
}

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {
    try {
      // Ticket topic seçildi
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "wartex_ticket_select"
      ) {
        return createTicket(
          interaction,
          interaction.values[0]
        );
      }

      // Ticket kapatıldı
      if (
        interaction.isButton() &&
        interaction.customId ===
          "wartex_close_ticket"
      ) {
        return closeTicket(
          interaction
        );
      }
    } catch (error) {
      console.error(
        "❌ Interaction error:",
        error
      );

      const response = {
        content:
          "❌ An error occurred. Please try again.",
        ephemeral: true
      };

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction
          .followUp(response)
          .catch(() => {});
      } else {
        await interaction
          .reply(response)
          .catch(() => {});
      }
    }
  }
);

// ======================================================
// ERROR HANDLING
// ======================================================

client.on(
  "error",
  error => {
    console.error(
      "❌ Discord error:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

if (!TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN bulunamadı!"
  );

  process.exit(1);
}

client
  .login(TOKEN)
  .then(() => {
    console.log(
      "🔗 Discord login successful."
    );
  })
  .catch(error => {
    console.error(
      "❌ Discord login failed:",
      error
    );

    process.exit(1);
  });