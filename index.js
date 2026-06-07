// ===============================
//  BOT GENDARMERIE
// ===============================

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  Collection
} = require("discord.js");
const Database = require("better-sqlite3");

// ===============================
//  CONFIG
// ===============================

const TOKEN = process.env.TOKEN;
const GUILD_ID = "1508154312595869726";              // à remplacer
const RECRUT_CHANNEL_ID = "1508424179496517793";  // salon où sera le message permanent
const LOGS_CHANNEL_ID = "1513024023401992292";      // salon logs recruteurs
const ROLE_GRADE_ID = "1508184761380638820";        // rôle minimum pour les commandes gestion

// ===============================
//  CLIENT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
});

// ===============================
//  DB (SQLite)
// ===============================

const db = new Database("./gendarmerie.db");

// Table dossiers gendarmes
db.prepare(`
  CREATE TABLE IF NOT EXISTS gendarmes (
    userId TEXT PRIMARY KEY,
    nigend TEXT UNIQUE,
    nomRp TEXT,
    prenomRp TEXT,
    ageRp TEXT,
    specialisation TEXT,
    affectation TEXT,
    grade TEXT,
    dateCreation INTEGER
  )
`).run();

// Table notes
db.prepare(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    auteurId TEXT,
    contenu TEXT,
    date INTEGER
  )
`).run();

// Table meta (pour compteur NIGEND)
db.prepare(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

// ===============================
//  HELPERS DB
// ===============================

function getMeta(key) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  db.prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function generateNigend() {
  let current = parseInt(getMeta("nigend_counter") || "0", 10);
  current += 1;
  setMeta("nigend_counter", String(current));
  return String(current).padStart(6, "0");
}

function createDossier({
  userId,
  nomRp,
  prenomRp,
  ageRp,
  specialisation,
  affectation
}) {
  const nigend = generateNigend();
  const now = Date.now();

  db.prepare(`
    INSERT INTO gendarmes (userId, nigend, nomRp, prenomRp, ageRp, specialisation, affectation, grade, dateCreation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    nigend,
    nomRp,
    prenomRp,
    ageRp,
    specialisation,
    affectation,
    "GAV", // grade par défaut
    now
  );

  return nigend;
}

function getDossierByUserId(userId) {
  return db.prepare("SELECT * FROM gendarmes WHERE userId = ?").get(userId);
}

function getDossierByNigend(nigend) {
  return db.prepare("SELECT * FROM gendarmes WHERE nigend = ?").get(nigend);
}

function addNote(userId, auteurId, contenu) {
  db.prepare(`
    INSERT INTO notes (userId, auteurId, contenu, date)
    VALUES (?, ?, ?, ?)
  `).run(userId, auteurId, contenu, Date.now());
}

function getNotes(userId, limit = 5) {
  return db.prepare(`
    SELECT * FROM notes
    WHERE userId = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(userId, limit);
}

function updateGrade(userId, grade) {
  db.prepare(`
    UPDATE gendarmes
    SET grade = ?
    WHERE userId = ?
  `).run(grade, userId);
}

// ===============================
//  READY + REGISTRATION COMMANDES
// ===============================

client.once("ready", async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  // Enregistrement des commandes slash
  const commands = [
    new SlashCommandBuilder()
      .setName("ajouter")
      .setDescription("Ajouter une note au dossier d'un gendarme")
      .addUserOption(o =>
        o.setName("membre").setDescription("Membre cible").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("note").setDescription("Contenu de la note").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("consulter")
      .setDescription("Consulter le dossier d'un gendarme")
      .addUserOption(o =>
        o.setName("membre").setDescription("Membre cible").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("promouvoir")
      .setDescription("Promouvoir un gendarme")
      .addUserOption(o =>
        o.setName("membre").setDescription("Membre cible").setRequired(true)
      )
      .addStringOption(o =>
        o
          .setName("grade")
          .setDescription("Nouveau grade")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("rechercher")
      .setDescription("Rechercher un gendarme")
      .addUserOption(o =>
        o.setName("membre").setDescription("Membre cible").setRequired(false)
      )
      .addStringOption(o =>
        o.setName("nigend").setDescription("NIGEND à rechercher").setRequired(false)
      )
  ].map(c => c.toJSON());

  await guild.commands.set(commands);
  console.log("Commandes slash enregistrées.");

  // (Optionnel) envoyer le message de recrutement une fois :
  // await sendRecruitmentMessage();
});

// ===============================
//  MESSAGE RECRUTEMENT
// ===============================

async function sendRecruitmentMessage() {
  const channel = await client.channels.fetch(RECRUT_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Recrutement Gendarmerie")
    .setDescription(
      "Bienvenue dans le service de recrutement de la Gendarmerie.\n\n" +
        "• **S'identifier** : si tu es déjà gendarme et que tu veux lier ton dossier.\n" +
        "• **Candidater** : pour déposer une nouvelle candidature."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gnd_identify")
      .setLabel("S'identifier")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("gnd_apply")
      .setLabel("Candidater")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ===============================
//  INTERACTIONS — BOUTONS & MODALS
// ===============================

client.on("interactionCreate", async (interaction) => {
  // Boutons
  if (interaction.isButton()) {
    if (interaction.customId === "gnd_apply") {
      const modal = new ModalBuilder()
        .setCustomId("gnd_apply_modal")
        .setTitle("Candidature Gendarmerie");

      const nomInput = new TextInputBuilder()
        .setCustomId("nom_rp")
        .setLabel("Nom RP")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const prenomInput = new TextInputBuilder()
        .setCustomId("prenom_rp")
        .setLabel("Prénom RP")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const ageInput = new TextInputBuilder()
        .setCustomId("age_rp")
        .setLabel("Âge RP")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const specInput = new TextInputBuilder()
        .setCustomId("specialisation")
        .setLabel("Spécialisation souhaitée")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const affectInput = new TextInputBuilder()
        .setCustomId("affectation")
        .setLabel("Affectation souhaitée")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(nomInput);
      const row2 = new ActionRowBuilder().addComponents(prenomInput);
      const row3 = new ActionRowBuilder().addComponents(ageInput);
      const row4 = new ActionRowBuilder().addComponents(specInput);
      const row5 = new ActionRowBuilder().addComponents(affectInput);

      modal.addComponents(row1, row2, row3, row4, row5);

      return interaction.showModal(modal);
    }

    if (interaction.customId === "gnd_identify") {
      // Pour plus tard : lier un user à un dossier existant
      return interaction.reply({
        content: "Fonction d'identification à venir.",
        ephemeral: true
      });
    }
  }

  // Modal submit
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "gnd_apply_modal") {
      const nomRp = interaction.fields.getTextInputValue("nom_rp").trim();
      const prenomRp = interaction.fields.getTextInputValue("prenom_rp").trim();
      const ageRp = interaction.fields.getTextInputValue("age_rp").trim();
      const specialisation = interaction.fields.getTextInputValue("specialisation").trim();
      const affectation = interaction.fields.getTextInputValue("affectation").trim();

      // Vérifier si dossier existe déjà
      const existing = getDossierByUserId(interaction.user.id);
      if (existing) {
        return interaction.reply({
          content: `Tu as déjà un dossier actif avec le NIGEND **${existing.nigend}**.`,
          ephemeral: true
        });
      }

      // Création dossier + NIGEND
      const nigend = createDossier({
        userId: interaction.user.id,
        nomRp,
        prenomRp,
        ageRp,
        specialisation,
        affectation
      });

      // Renommage
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.setNickname(`${nomRp} ${prenomRp} [${nigend}]`);
      } catch (e) {
        // ignore si pas de permission
      }

      // Logs recruteurs
      try {
        const logChannel = await client.channels.fetch(LOGS_CHANNEL_ID);
        if (logChannel && logChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("Nouvelle candidature Gendarmerie")
            .setDescription(
              [
                `👤 **Membre :** ${interaction.user} (${interaction.user.id})`,
                `🆔 **NIGEND :** ${nigend}`,
                `📛 **Identité RP :** ${nomRp} ${prenomRp}`,
                `🎂 **Âge RP :** ${ageRp}`,
                `🎯 **Spécialisation :** ${specialisation}`,
                `📍 **Affectation :** ${affectation}`
              ].join("\n")
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      } catch (e) {
        // ignore
      }

      return interaction.reply({
        content: `Ta candidature a été enregistrée. Ton NIGEND est **${nigend}**.`,
        ephemeral: true
      });
    }
  }

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const name = interaction.commandName;

    // Vérif permission gradé
    const member = interaction.member;
    if (!member.roles.cache.has(ROLE_GRADE_ID)) {
      return interaction.reply({
        content: "Tu n'as pas les permissions pour utiliser ces commandes.",
        ephemeral: true
      });
    }

    // /ajouter
    if (name === "ajouter") {
      const target = interaction.options.getUser("membre", true);
      const note = interaction.options.getString("note", true);

      const dossier = getDossierByUserId(target.id);
      if (!dossier) {
        return interaction.reply({
          content: "Aucun dossier trouvé pour ce membre.",
          ephemeral: true
        });
      }

      addNote(target.id, interaction.user.id, note);

      return interaction.reply({
        content: `Note ajoutée au dossier de **${dossier.nomRp} ${dossier.prenomRp} [${dossier.nigend}]**.`,
        ephemeral: true
      });
    }

    // /consulter
    if (name === "consulter") {
      const target = interaction.options.getUser("membre", true);
      const dossier = getDossierByUserId(target.id);

      if (!dossier) {
        return interaction.reply({
          content: "Aucun dossier trouvé pour ce membre.",
          ephemeral: true
        });
      }

      const notes = getNotes(target.id, 3);
      const notesText =
        notes.length === 0
          ? "Aucune note."
          : notes
              .map(
                (n) =>
                  `• <@${n.auteurId}> — ${new Date(n.date).toLocaleString()} : ${n.contenu}`
              )
              .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Dossier de ${dossier.nomRp} ${dossier.prenomRp}`)
        .addFields(
          { name: "NIGEND", value: dossier.nigend, inline: true },
          { name: "Grade", value: dossier.grade || "Non défini", inline: true },
          { name: "Affectation", value: dossier.affectation || "Non définie", inline: true },
          { name: "Spécialisation", value: dossier.specialisation || "Non définie", inline: true },
          {
            name: "Notes récentes",
            value: notesText
          }
        )
        .setFooter({ text: "Dossier Gendarmerie" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /promouvoir
    if (name === "promouvoir") {
      const target = interaction.options.getUser("membre", true);
      const grade = interaction.options.getString("grade", true);

      const dossier = getDossierByUserId(target.id);
      if (!dossier) {
        return interaction.reply({
          content: "Aucun dossier trouvé pour ce membre.",
          ephemeral: true
        });
      }

      updateGrade(target.id, grade);

      return interaction.reply({
        content: `Le grade de **${dossier.nomRp} ${dossier.prenomRp} [${dossier.nigend}]** est maintenant **${grade}**.`,
        ephemeral: true
      });
    }

    // /rechercher
    if (name === "rechercher") {
      const target = interaction.options.getUser("membre");
      const nigend = interaction.options.getString("nigend");

      let dossier = null;

      if (target) {
        dossier = getDossierByUserId(target.id);
      } else if (nigend) {
        dossier = getDossierByNigend(nigend);
      } else {
        return interaction.reply({
          content: "Merci de fournir soit un membre, soit un NIGEND.",
          ephemeral: true
        });
      }

      if (!dossier) {
        return interaction.reply({
          content: "Aucun dossier trouvé.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2980b9)
        .setTitle(`Profil ${dossier.nomRp} ${dossier.prenomRp}`)
        .setDescription(
          [
            `👤 **User ID :** ${dossier.userId}`,
            `🆔 **NIGEND :** ${dossier.nigend}`,
            `🎖 **Grade :** ${dossier.grade || "Non défini"}`,
            `📍 **Affectation :** ${dossier.affectation || "Non définie"}`,
            `🎯 **Spécialisation :** ${dossier.specialisation || "Non définie"}`
          ].join("\n")
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

// ===============================
//  LOGIN
// ===============================
console.log("TOKEN chargé ?", process.env.TOKEN ? "OUI" : "NON");
client.login(TOKEN);
