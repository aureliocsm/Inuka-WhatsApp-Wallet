import './GetStarted.css';

function GetStarted() {
  return (
    <section id="get-started" className="section get-started">
      <div className="container">
        <div className="cta-box">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Saving Together?</h2>
            <p className="cta-description">
              Join INUKA Pay today and experience the future of group savings and lending.
              Simple, secure, and powered by blockchain.
            </p>

            <div className="cta-steps">
              <div className="cta-step">
                <span className="cta-step-number">1</span>
                <span className="cta-step-text">Send "menu" to our WhatsApp</span>
              </div>
              <div className="cta-step">
                <span className="cta-step-number">2</span>
                <span className="cta-step-text">Set up your secure PIN</span>
              </div>
              <div className="cta-step">
                <span className="cta-step-number">3</span>
                <span className="cta-step-text">Create or join a Chama</span>
              </div>
            </div>

            <div className="cta-buttons">
              <a
                href="https://wa.me/YOUR_WHATSAPP_NUMBER?text=menu"
                className="btn btn-primary btn-large"
                target="_blank"
                rel="noopener noreferrer"
              >
                Start on WhatsApp
              </a>
              <a
                href="https://github.com/yourusername/inuka-pay"
                className="btn btn-secondary btn-large"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </div>
          </div>

          <div className="cta-benefits">
            <div className="benefit">
              <div className="benefit-icon">✓</div>
              <span>No app downloads required</span>
            </div>
            <div className="benefit">
              <div className="benefit-icon">✓</div>
              <span>100% transparent transactions</span>
            </div>
            <div className="benefit">
              <div className="benefit-icon">✓</div>
              <span>Secure blockchain technology</span>
            </div>
            <div className="benefit">
              <div className="benefit-icon">✓</div>
              <span>Democratic loan approval</span>
            </div>
          </div>
        </div>

        <div className="info-cards">
          <div className="card info-card">
            <h3>📚 Documentation</h3>
            <p>Comprehensive guides on using INUKA Pay, from setup to advanced features.</p>
            <a href="#" className="info-link">Read Docs →</a>
          </div>

          <div className="card info-card">
            <h3>📜 Smart Contracts</h3>
            <p>View our open-source smart contracts on Scroll Sepolia testnet.</p>
            <a href="https://sepolia.scrollscan.com/address/0x022fe1ad010b32993c73C29F2577A961579d27f1" className="info-link" target="_blank" rel="noopener noreferrer">View Contract →</a>
          </div>

          <div className="card info-card">
            <h3>💬 Community</h3>
            <p>Join our community to get help, share ideas, and connect with other users.</p>
            <a href="#" className="info-link">Join Discord →</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GetStarted;
