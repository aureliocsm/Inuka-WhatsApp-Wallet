import './HowItWorks.css';

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Start with WhatsApp',
      description: 'Send "menu" to our WhatsApp bot to get started. Set up your 4-digit PIN for secure transactions.',
      icon: '💬'
    },
    {
      number: '02',
      title: 'Create or Join a Chama',
      description: 'Create a new savings group or join existing ones using an invite code. Each Chama gets its own smart contract.',
      icon: '👥'
    },
    {
      number: '03',
      title: 'Contribute & Save',
      description: 'Make contributions in ETH or TZS tokens. All transactions are recorded on the blockchain for transparency.',
      icon: '💰'
    },
    {
      number: '04',
      title: 'Request & Vote on Loans',
      description: 'Need funds? Request a loan from your Chama. Members vote democratically, with 51% approval needed.',
      icon: '🗳️'
    }
  ];

  return (
    <section id="how-it-works" className="section how-it-works">
      <div className="container">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          Get started in minutes with our simple, intuitive process
        </p>

        <div className="steps-container">
          {steps.map((step, index) => (
            <div key={index} className="step">
              <div className="step-content">
                <div className="step-number">{step.number}</div>
                <div className="step-icon">{step.icon}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="step-connector">
                  <div className="connector-line"></div>
                  <div className="connector-arrow">→</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="demo-box">
          <h3 className="demo-title">Example Commands</h3>
          <div className="demo-commands">
            <div className="command">
              <span className="command-text">menu</span>
              <span className="command-desc">Show main menu</span>
            </div>
            <div className="command">
              <span className="command-text">contribute</span>
              <span className="command-desc">Add funds to a Chama</span>
            </div>
            <div className="command">
              <span className="command-text">loan</span>
              <span className="command-desc">Request a loan</span>
            </div>
            <div className="command">
              <span className="command-text">approve_[id]</span>
              <span className="command-desc">Vote yes on a loan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
