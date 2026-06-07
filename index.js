const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField 
} = require('discord.js');
const { updateDossier, saveDossier, isAlreadyRegistered, getDossiers, updateGrade, addCertif, findByName, updateByName } = require('./dataManager');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// Configuration des IDs (à modifier selon ton serveur)
const CONFIG = {
    ROLE_GRADES: '1508184761380638820',
    ROLE_IDENTIFIE: '1508471664911056996',
    ROLE_CIVIL: '1508169380276601006'
};

client.on('ready', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// Gestion des interactions
client.on('interactionCreate', async (interaction) => {
    
    // --- Gestion des Boutons ---
    if (interaction.isButton() && interaction.customId === 'start_id') {
        if (isAlreadyRegistered(interaction.user.id)) 
            return interaction.reply({ content: "❌ Déjà identifié.", ephemeral: true });
        
        const modal = new ModalBuilder().setCustomId('id_modal').setTitle('Identification');
        const input = new TextInputBuilder().setCustomId('nomInput').setLabel('Nom Prénom RP').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // --- Gestion des Modals ---
    if (interaction.isModalSubmit() && interaction.customId === 'id_modal') {
        const nom = interaction.fields.getTextInputValue('nomInput');
        const nigend = Math.floor(100000 + Math.random() * 900000).toString();
        
        try {
            await interaction.member.setNickname(`[${nigend}] ${nom}`);
            await interaction.member.roles.add(CONFIG.ROLE_IDENTIFIE);
            await interaction.member.roles.remove(CONFIG.ROLE_CIVIL);
            saveDossier(nigend, { nom, discordId: interaction.user.id, notes: [], certifs: [], grade: 'Recrue' });
            await interaction.reply({ content: `✅ Identité enregistrée. Matricule : **${nigend}**`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: "❌ Erreur de permissions.", ephemeral: true });
        }
    }

    // --- Gestion des Commandes Slash ---
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        
        // Vérification permission (Alternative: utiliser les permissions Discord nativement)
        if (!interaction.member.roles.cache.has(CONFIG.ROLE_GRADES)) 
            return interaction.reply({ content: "Accès réservé aux gradés.", ephemeral: true });

        const nom = options.getString('nom');

        switch (commandName) {
            case 'ajouter':
                const info = options.getString('info');
                if (updateByName(nom, (d) => { d.notes = d.notes || []; d.notes.push(info); })) {
                    await interaction.reply(`✅ Note ajoutée à **${nom}**.`);
                } else { await interaction.reply("❌ Gendarme introuvable."); }
                break;

            case 'consulter':
                const nigend = options.getString('nigend');
                const d = getDossiers()[nigend];
                if (!d) return interaction.reply("❌ Dossier introuvable.");
                
                const embed = new EmbedBuilder()
                    .setTitle(`Dossier : ${d.nom}`)
                    .setColor(0x3498DB)
                    .addFields(
                        { name: 'Grade', value: d.grade || 'Non défini', inline: true },
                        { name: 'Matricule', value: nigend, inline: true },
                        { name: 'Compétences', value: (d.certifs?.join(', ') || 'Aucune') },
                        { name: 'Notes', value: (d.notes?.join('\n') || 'Aucune') }
                    );
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;

            case 'promouvoir':
                const grade = options.getString('grade');
                const p = findByName(nom);
                if (p && updateGrade(p.nigend, grade)) await interaction.reply(`✅ Grade de ${p.nom} mis à jour : **${grade}**`);
                else await interaction.reply("❌ Gendarme introuvable.");
                break;

            case 'rechercher':
                const r = findByName(nom);
                if (r) await interaction.reply(`🔍 **${r.nom}** | Matricule: ${r.nigend} | Grade: ${r.grade}`);
                else await interaction.reply("❌ Aucun Gendarme trouvé.");
                break;
        }
    }
});

client.login(process.env.DISCORD_TOKEN);