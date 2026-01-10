const ScoutAgent = require('./scout');
const NegotiatorAgent = require('./negotiator');

class AgentServer {
  constructor(model) {
    // For now, model is optional - will be set up with actual AI model later
    this.scout = new ScoutAgent(model);
    this.negotiator = new NegotiatorAgent(model);
    this.setupCommunication();
  }

  setupCommunication() {
    // Connect agents
    this.scout.setNegotiator(this.negotiator);
  }

  async start() {
    console.log('Agent server started');
    console.log('Scout agent ready');
    console.log('Negotiator agent ready');
  }

  async processRequest(imageUrl, budget) {
    return await this.scout.processRequest(imageUrl, budget);
  }
}

// Example usage
if (require.main === module) {
  const server = new AgentServer();
  server.start().then(() => {
    // Example request
    server.processRequest('https://example.com/clothing.jpg', 100)
      .then(result => {
        console.log('Final result:', result);
      });
  });
}

module.exports = AgentServer;
