const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const CosmosClient = require('@azure/cosmos').CosmosClient;
const config = require('./config');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para analisar o corpo da solicitação
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configurar arquivos estáticos (se você tiver uma pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// Configurar multer para processar uploads de arquivo
const upload = multer({ dest: 'uploads/' });

// Cosmos DB configuration
const endpoint = config.endpoint;
const key = config.key;
const databaseId = config.database.id;
const containerId = config.container.id;
const partitionKey = { kind: 'Hash', paths: ['/partitionKey'] };

const options = {
  endpoint: endpoint,
  key: key,
  userAgentSuffix: 'CosmosDBJavascriptQuickstart'
};

const client = new CosmosClient(options);
let container;

// Middleware para verificar se o container está inicializado
app.use((req, res, next) => {
  if (!container) {
    return res.status(503).json({ success: false, message: 'Database not initialized yet. Please try again later.' });
  }
  next();
});

// Inicializar o banco de dados e o contêiner
async function initialize() {
  try {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container: cont } = await database.containers.createIfNotExists({ id: containerId, partitionKey });
    container = cont;
    console.log('Conectado ao Azure Cosmos DB');

    // Start the server after the initialization is complete
    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error initializing Cosmos DB:', error);
    process.exit(1); // Exit the process if initialization fails
  }
}

initialize();

// Rota para registrar uma fatura
app.post('/adicionar_faturas', async (req, res) => {
  const { description, amount, pdfUrl } = req.body;

  if (description && amount > 0) {
    try {
      // Obter a fatura mais recente
      const querySpec = {
        query: "SELECT * FROM c ORDER BY c._ts DESC OFFSET 0 LIMIT 1"
      };
      const { resources: items } = await container.items.query(querySpec).fetchAll();
      let lastId = 0;
      let lastPartitionKey = "fatura0";
      
      if (items.length > 0) {
        const lastItem = items[0];
        lastId = parseInt(lastItem.id);
        lastPartitionKey = lastItem.partitionKey;
      }

      // Incrementar ID e chave de partição
      const newId = (lastId + 1).toString();
      const newPartitionKey = "fatura" + (parseInt(lastPartitionKey.replace('fatura', '')) + 1);

      const item = { id: newId, partitionKey: newPartitionKey, description, amount, pdfUrl };

      // Criar nova fatura
      const { resource: createdItem } = await container.items.create(item);
      res.status(201).json({ success: true, message: 'Fatura registrada com sucesso', item: createdItem });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Erro ao registrar a fatura' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Dados inválidos' });
  }
});


// Rota para obter todas as faturas
app.get('/faturas', async (req, res) => {
  try {
    const { resources: items } = await container.items.readAll().fetchAll();
    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao obter as faturas' });
  }
});

app.delete('/deleteExpense/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Obter a fatura para garantir que ela existe e obter a chave de partição correta
    const { resource: item } = await container.item(id).read();

    if (!item) {
      return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
    }

    // Excluir a fatura usando o ID e a chave de partição correta
    await container.item(id).delete();

    res.status(200).json({ success: true, message: 'Fatura excluída com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao excluir a fatura' });
  }
});

// Rota para lidar com o upload de arquivo PDF
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
  const pdfPath = req.file.path;

  fs.readFile(pdfPath, async (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erro ao ler o arquivo PDF' });
    }

    const attachments = data.toString('base64');

    try {
      const { resource: createdItem } = await container.items.create({ attachments });
      res.status(201).json({ success: true, message: 'PDF enviado com sucesso', item: createdItem });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Erro ao enviar o PDF' });
    }
  });
});

// Rota para visualizar um PDF
app.get('/viewPDF/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { resource: item } = await container.item(id, id).read();
    const attachments = item.attachments;

    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(attachments, 'base64'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao visualizar o PDF' });
  }
});