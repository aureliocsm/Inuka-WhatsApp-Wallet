import './Hero.css';

function Hero() {
  return (
    <section className="hero">
      <div className="hero-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="container">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">🚀</span>
            <span>Powered by Blockchain Technology</span>
          </div>

          <h1 className="hero-title">
            INUKA Pay
            <br />
            <span className="hero-title-gradient">WhatsApp Chama Platform</span>
          </h1>

          <p className="hero-description">
            Create and manage group savings (Chamas) directly from WhatsApp.
            Powered by blockchain technology for transparent, secure, and automated
            financial operations.
          </p>

          <div className="hero-buttons">
            <a href="#get-started" className="btn btn-primary">
              Get Started
            </a>
            <a href="#how-it-works" className="btn btn-secondary">
              Learn More
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">100%</div>
              <div className="stat-label">Transparent</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Available</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <div className="stat-value">Instant</div>
              <div className="stat-label">Transactions</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
