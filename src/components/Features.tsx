import './Features.css';

function Features() {
  const features = [
    {
      icon: '💬',
      title: 'WhatsApp Integration',
      description: 'Manage everything directly from WhatsApp. No app downloads, no complicated interfaces. Just chat and transact.'
    },
    {
      icon: '🔐',
      title: 'Secure Wallets',
      description: 'Each user gets a personal blockchain wallet with encrypted private keys. Your funds, your control.'
    },
    {
      icon: '👥',
      title: 'Group Savings (Chamas)',
      description: 'Create or join savings groups with transparent on-chain tracking of all contributions and balances.'
    },
    {
      icon: '💰',
      title: 'Smart Loans',
      description: 'Request loans from your Chama with democratic voting system. Transparent, fair, and automated.'
    },
    {
      icon: '🗳️',
      title: 'Democratic Voting',
      description: '51% approval threshold for all loan requests. Every member has a voice in group decisions.'
    },
    {
      icon: '⚡',
      title: 'Multi-Token Support',
      description: 'Support for ETH and TZS tokens with automatic approval handling for seamless transactions.'
    },
    {
      icon: '🔒',
      title: 'Lockup Periods',
      description: '3-month default lockup ensures commitment and stability for group savings goals.'
    },
    {
      icon: '📊',
      title: 'Transparent Tracking',
      description: 'All transactions on blockchain. View contributions, loans, and balances anytime with full transparency.'
    }
  ];

  return (
    <section id="features" className="section features">
      <div className="container">
        <h2 className="section-title">Powerful Features</h2>
        <p className="section-subtitle">
          Everything you need to manage group savings and lending, right from WhatsApp
        </p>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="card feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
