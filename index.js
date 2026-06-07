const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes 
} = require('discord.js');
const { updateDossier, saveDossier, isAlreadyRegistered, getDossiers, updateGrade, addCertif, findByName, updateByName } = require('./dataManager');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// CONFIGURATION
const CONFIG = {
    ROLE_GRADES: '1508184761380638820',
    ROLE_IDENTIFIE: '1508471664911056996',
    ROLE_CIVIL: '1508169380276601006'
};

const commands = [
    { name: 'ajouter', description: 'Ajouter une note', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }, { name: 'info', type: 3, description: 'Info', required: true }] },
    { name: 'consulter', description: 'Consulter un dossier', options: [{ name: 'nigend', type: 3, description: 'NIGEND', required: true }] },
    { name: 'promouvoir', description: 'Promouvoir', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }, { name: 'grade', type: 3, description: 'Grade', required: true }] },
    { name: 'rechercher', description: 'Chercher', options: [{ name: 'nom', type: 3, description: 'Nom', required: true }] }
];

// 1. ENREGISTREMENT DES COMMANDES
client.once('ready', async () => {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Bot prêt et commandes enregistrées.');
    } catch (e) { console.error(e); }
});

// 2. GESTION DES MESSAGES (Pour !identification)
client.on('messageCreate', async (message) => {
    if (message.content === '!identification') {
        const embed = new EmbedBuilder().setTitle('Gendarmerie - Identification').setColor(0x3498DB).setDescription('Cliquez ci-dessous pour vous identifier.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_id').setLabel('S\'identifier').setStyle(ButtonStyle.Primary));
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// 3. GESTION DES INTERACTIONS
client.on('interactionCreate', async (interaction) => {
    // Boutons
    if (interaction.isButton() && interaction.customId === 'start_id') {
        if (isAlreadyRegistered(interaction.user.id)) return interaction.reply({ content: "❌ Déjà identifié.", ephemeral: true });
        const modal = new ModalBuilder().setCustomId('id_modal').setTitle('Identification');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nomInput').setLabel('Nom Prénom RP').setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
    }

    // Modals
    if (interaction.isModalSubmit() && interaction.customId === 'id_modal') {
        const nom = interaction.fields.getTextInputValue('nomInput');
        const nigend = Math.floor(100000 + Math.random() * 900000).toString();
        try {
            await interaction.member.setNickname(`[${nigend}] ${nom}`);
            await interaction.member.roles.add(CONFIG.ROLE_IDENTIFIE);
            await interaction.member.roles.remove(CONFIG.ROLE_CIVIL);
            saveDossier(nigend, { nom, discordId: interaction.user.id, notes: [], certifs: [], grade: 'Recrue' });
            await interaction.reply({ content: `✅ Identité enregistrée. Matricule : **${nigend}**`, ephemeral: true });
        } catch (e) { await interaction.reply({ content: "❌ Erreur permissions.", ephemeral: true }); }
    }

    // Commandes Slash
    if (interaction.isChatInputCommand()) {
        if (!interaction.member.roles.cache.has(CONFIG.ROLE_GRADES)) return interaction.reply({ content: "Accès réservé.", ephemeral: true });
        const { commandName, options } = interaction;
        const nom = options.getString('nom');

        switch (commandName) {
            case 'ajouter':
                const info = options.getString('info');
                if (updateByName(nom, (d) => { d.notes = d.notes || []; d.notes.push(info); })) await interaction.reply(`✅ Note ajoutée à **${nom}**.`);
                else await interaction.reply("❌ Introuvable.");
                break;

            case 'consulter':
                const d = getDossiers()[options.getString('nigend')];
                if (!d) return interaction.reply("❌ Dossier introuvable.");
                const embed = new EmbedBuilder().setTitle(`Dossier : ${d.nom}`).setColor(0x3498DB)
                    .addFields({ name: 'Grade', value: d.grade || 'Non défini', inline: true }, { name: 'Matricule', value: options.getString('nigend'), inline: true }, { name: 'Notes', value: (d.notes?.join('\n') || 'Aucune') });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;

            case 'promouvoir':
                const p = findByName(nom);
                if (p && updateGrade(p.nigend, options.getString('grade'))) await interaction.reply(`✅ Grade de ${p.nom} mis à jour.`);
                else await interaction.reply("❌ Introuvable.");
                break;

            case 'rechercher':
                const r = findByName(nom);
                if (r) await interaction.reply(`🔍 ${r.nom} | Matricule: ${r.nigend} | Grade: ${r.grade}`);
                else await interaction.reply("❌ Aucun Gendarme trouvé.");
                break;
        }
    }
});

client.login(process.env.DISCORD_TOKEN);