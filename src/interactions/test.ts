import { CommandInteraction, Interaction } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/util";
import { logMessage } from "../api/util";
import { getUserByDiscordId } from '../api/bot-db';
import { NexusModsGQLClient } from "../api/NexusModsGQLClient";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'test',
        description: 'Testing GQL.',
        // options: [{
        //     name: 'usertofind',
        //     type: 'STRING',
        //     description: 'Username search.',
        //     required: true,
        // }],
        // defaultPermission: false
    },
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    permissions: [
        // Admins in the Nexus Mods server.
        {
            guild: '215154001799413770',
            id: '215464099524378625',
            type: 'ROLE',
            permission: true
        },
        // Pickysaurus
        {
            id: '296052251234009089',
            type: 'USER',
            permission: true
        }
    ],
    action
}

async function action(client: ClientExt, baseinteraction: Interaction): Promise<any> {
    const interaction = baseinteraction as CommandInteraction;
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const user = await getUserByDiscordId(discordId);
    const GQL = await NexusModsGQLClient.create(user);
    const ids = { gameDomain: 'site', modId: 1 }
    // const searchTerm = interaction.options.getString('usertofind', true);
    try {
        // const result = await GQL.findUser(searchTerm);
        const result = await GQL.myCollections();
        return interaction.editReply(`\`\`\`json\n${JSON.stringify(result[0], null, 2)}\n\`\`\``);
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }