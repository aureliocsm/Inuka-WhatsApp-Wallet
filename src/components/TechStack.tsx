import './TechStack.css';

function TechStack() {
  const technologies = [
    {
      name: 'Scroll Sepolia',
      description: 'Layer 2 blockchain for fast, low-cost transactions',
      icon: '⛓️',
      color: '#f59e0b'
    },
    {
      name: 'Smart Contracts',
      description: 'Solidity contracts for Chamas and Factory pattern',
      icon: '📜',
      color: '#3b82f6'
    },
    {
      name: 'Supabase',
      description: 'Database and authentication backend',
      icon: '🗄️',
      color: '#10b981'
    },
    {
      name: 'WhatsApp API',
      description: 'Meta Business API for seamless messaging',
      icon: '💬',
      color: '#25d366'
    },
    {
      name: 'Ethers.js',
      description: 'Blockchain interaction library',
      icon: '🔧',
      color: '#627eea'
    },
    {
      name: 'Edge Functions',
      description: 'Serverless Deno functions for webhooks',
      icon: '⚡',
      color: '#6366f1'
    }
  ];

  return (
    <section className="section tech-stack">
      <div className="container">
        <h2 className="section-title">Built with Modern Technology</h2>
        <p className="section-subtitle">
          Leveraging the best tools for security, speed, and reliability
        </p>

        <div className="tech-grid">
          {technologies.map((tech, index) => (
            <div key={index} className="card tech-card">
              <div className="tech-icon" style={{ color: tech.color }}>
                {tech.icon}
              </div>
              <h3 className="tech-name">{tech.name}</h3>
              <p className="tech-description">{tech.description}</p>
            </div>
          ))}
        </div>

        <div className="tech-highlight">
          <div className="highlight-content">
            <h3 className="highlight-title">Why Blockchain?</h3>
            <div className="highlight-grid">
              <div className="highlight-item">
                <div className="highlight-icon">✅</div>
                <div className="highlight-text">
                  <h4>Transparency</h4>
                  <p>Every transaction is recorded on-chain and verifiable</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon">🔒</div>
                <div className="highlight-text">
                  <h4>Security</h4>
                  <p>Immutable records protected by cryptographic algorithms</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon">⚙️</div>
                <div className="highlight-text">
                  <h4>Automation</h4>
                  <p>Smart contracts execute automatically without intermediaries</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon">🌍</div>
                <div className="highlight-text">
                  <h4>Accessibility</h4>
                  <p>Available 24/7 from anywhere with internet access</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TechStack;
