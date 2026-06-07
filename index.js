const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes 
} = require('discord.js');
const { saveDossier, isAlreadyRegistered, getDossiers, updateGrade, findByName, updateByName } = require('./dataManager');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// CONFIGURATION - REMPLIS LES IDs ICI
const CONFIG = {
    ROLE_GRADES: '1508184761380638820',
    ROLE_IDENTIFIE: '1508471664911056996',
    ROLE_CIVIL: '1508169380276601006',
    LOG_CHANNEL_ID: 'TON_ID_SALON_LOGS' 
};

// 1. COMMANDE SLASH (pour enregistrer via le bot)
const commands = [
    { name: 'ajouter', description: 'Ajouter une note', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }, { name: 'info', type: 3, description: 'Info', required: true }] },
    { name: 'consulter', description: 'Consulter un dossier', options: [{ name: 'nigend', type: 3, description: 'NIGEND', required: true }] },
    { name: 'promouvoir', description: 'Promouvoir', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }, { name: 'grade', type: 3, description: 'Grade', required: true }] },
    { name: 'rechercher', description: 'Chercher', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }] }
];

client.once('ready', async () => {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Bot opérationnel.');
    } catch (e) { console.error(e); }
});

// 2. MESSAGE D'IDENTIFICATION & RECRUTEMENT
client.on('messageCreate', async (message) => {
    if (message.content === '!identification') {
        const embed = new EmbedBuilder()
            .setTitle('Gendarmerie - Recrutement & Identification')
            .setColor(0x3498DB)
            .setDescription('Choisissez une action ci-dessous :');
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_id').setLabel('S\'identifier').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('start_candidature').setLabel('Candidater').setStyle(ButtonStyle.Success)
        );
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// 3. GESTION DES INTERACTIONS
client.on('interactionCreate', async (interaction) => {
    
    // --- BOUTONS ---
    if (interaction.isButton()) {
        if (interaction.customId === 'start_candidature') {
            const modal = new ModalBuilder().setCustomId('cand_modal').setTitle('Recrutement Gendarmerie');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nomPrenom').setLabel('Nom & Prénom RP').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().setComponents(new TextInputBuilder().setCustomId('age').setLabel('Âge RP').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().setComponents(new TextInputBuilder().setCustomId('spe').setLabel('Spécialisation souhaitée').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().setComponents(new TextInputBuilder().setCustomId('affect').setLabel('Affectation souhaitée').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }
        // ... (ton code pour start_id ici) ...
    }

    // --- FORMULAIRE DE CANDIDATURE ---
    if (interaction.isModalSubmit() && interaction.customId === 'cand_modal') {
        const nom = interaction.fields.getTextInputValue('nomPrenom');
        const age = interaction.fields.getTextInputValue('age');
        const spe = interaction.fields.getTextInputValue('spe');
        const affect = interaction.fields.getTextInputValue('affect');
        const nigend = Math.floor(100000 + Math.random() * 900000).toString();

        // Envoi dans les logs
        const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder().setTitle('📩 Nouvelle Candidature').setColor(0x2ECC71)
                .addFields({ name: 'Candidat', value: nom }, { name: 'Âge', value: age }, { name: 'Spécialisation', value: spe }, { name: 'Affectation', value: affect }, { name: 'NIGEND', value: nigend });
            await logChannel.send({ embeds: [embed] });
        }

        // Renommage et sauvegarde
        try {
            await interaction.member.setNickname(`${nom} [${nigend}]`);
            saveDossier(nigend, { nom, discordId: interaction.user.id, notes: [], certifs: [], grade: 'Recrue' });
            await interaction.reply({ content: `✅ Candidature envoyée ! Votre matricule est **${nigend}**.`, ephemeral: true });
        } catch (e) { await interaction.reply("❌ Erreur de permissions."); }
    }
});

client.login(process.env.DISCORD_TOKEN);