module.exports = async function (context, req) {
    const { CosmosClient } = require('@azure/cosmos');

    // Configurações do Cosmos DB
    const endpoint = config.endpoint;
    const key = config.key;
    const databaseId = config.database.id;
    const containerId = config.container.id;

    // Cria uma instância do CosmosClient
    const client = new CosmosClient({ endpoint, key });

    // Referência ao contêiner Cosmos DB
    const container = client.database(databaseId).container(containerId);

    switch (req.method) {
        case 'POST': // Rota para adicionar um arquivo
            await addFile(req, res, container);
            break;
        case 'DELETE': // Rota para excluir um arquivo
            await deleteFile(req, res, container);
            break;
        default:
            context.res = {
                status: 405,
                body: 'Método não permitido'
            };
            break;
    }
};

async function addFile(req, res, container) {
    const pdfData = req.body.pdfData; // Supondo que os dados do PDF sejam enviados no corpo da solicitação

    try {
        // Salvar os dados do PDF no Cosmos DB
        const { resource: createdItem } = await container.items.create({ pdfData });
        res.status(201).json({ success: true, message: 'PDF enviado com sucesso', item: createdItem });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erro ao enviar o PDF' });
    }
}

async function deleteFile(req, res, container) {
    const fileId = req.params.id; // Supondo que o ID do arquivo seja passado como um parâmetro na URL
    try {
        // Excluir o arquivo do Cosmos DB com base no ID
        await container.item(fileId, fileId).delete();
        res.status(200).json({ success: true, message: 'Arquivo excluído com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erro ao excluir o arquivo' });
    }
}
