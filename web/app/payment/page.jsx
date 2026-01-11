'use client';

import { useState, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Mock matches - Scout agent will replace this
const MOCK_MATCHES = [
  {
    id: '1',
    name: 'Vintage Rolex Submariner',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    seller: 'LuxuryTimepieces',
    askingPrice: 0.05,
    sizes: ['One Size'],
  },
  {
    id: '2',
    name: 'Classic Rolex Submariner',
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop',
    seller: 'WatchCollector99',
    askingPrice: 0.045,
    sizes: ['One Size'],
  },
  {
    id: '3',
    name: 'Rolex Submariner Date',
    image: 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=400&h=400&fit=crop',
    seller: 'TimelessWatches',
    askingPrice: 0.055,
    sizes: ['One Size'],
  },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#000',
    fontSize: '24px',
    fontWeight: 'bold',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    margin: 0,
  },
  titleAccent: {
    color: '#10b981',
  },
  subtitle: {
    color: '#666',
    fontSize: '16px',
    marginTop: '8px',
  },
  stepsContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '48px',
  },
  stepDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#333',
    transition: 'all 0.3s',
  },
  stepDotActive: {
    backgroundColor: '#10b981',
    boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
  },
  stepDotComplete: {
    backgroundColor: '#10b981',
  },
  stepLine: {
    width: '60px',
    height: '2px',
    backgroundColor: '#333',
    transition: 'all 0.3s',
  },
  stepLineComplete: {
    backgroundColor: '#10b981',
  },
  stepLabel: {
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginTop: '8px',
  },
  uploadArea: {
    border: '2px dashed #333',
    borderRadius: '16px',
    padding: '60px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    backgroundColor: '#111',
  },
  uploadIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  uploadText: {
    fontSize: '18px',
    color: '#888',
    marginBottom: '8px',
  },
  uploadSubtext: {
    fontSize: '14px',
    color: '#555',
  },
  uploadPreview: {
    maxWidth: '300px',
    maxHeight: '300px',
    borderRadius: '12px',
    margin: '0 auto',
  },
  matchesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '32px',
  },
  matchCard: {
    backgroundColor: '#111',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  matchCardSelected: {
    borderColor: '#10b981',
    boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
  },
  matchImage: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
  },
  matchInfo: {
    padding: '16px',
  },
  matchName: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matchSeller: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
  },
  matchPrice: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#10b981',
  },
  // Config panel styles
  configPanel: {
    backgroundColor: '#111',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  },
  configTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  formGroup: {
    marginBottom: '0',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  inputSuffix: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: '#222',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#888',
    fontWeight: '500',
  },
  inputWrapper: {
    position: 'relative',
  },
  // Chat styles
  chatContainer: {
    backgroundColor: '#111',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '550px',
  },
  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chatAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  chatTitle: {
    fontSize: '16px',
    fontWeight: '600',
  },
  chatStatus: {
    fontSize: '12px',
    color: '#10b981',
  },
  autoBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  chatMessages: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  message: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  messageBuyer: {
    alignSelf: 'flex-end',
    backgroundColor: '#10b981',
    color: '#000',
    borderBottomRightRadius: '4px',
  },
  messageSeller: {
    alignSelf: 'flex-start',
    backgroundColor: '#222',
    color: '#fff',
    borderBottomLeftRadius: '4px',
  },
  messageSystem: {
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    fontSize: '12px',
    padding: '8px 16px',
    borderRadius: '20px',
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
    marginTop: '4px',
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#222',
    borderRadius: '16px',
    borderBottomLeftRadius: '4px',
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#666',
  },
  chatFooter: {
    padding: '16px 20px',
    borderTop: '1px solid #222',
    backgroundColor: '#0a0a0a',
  },
  negotiationStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#10b981',
  },
  // Success styles
  successContainer: {
    textAlign: 'center',
    padding: '40px',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontSize: '40px',
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  successSubtitle: {
    color: '#666',
    fontSize: '16px',
    marginBottom: '32px',
  },
  detailsCard: {
    backgroundColor: '#111',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'left',
    marginBottom: '24px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #222',
  },
  detailLabel: {
    color: '#666',
    fontSize: '14px',
  },
  detailValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  detailValueGreen: {
    color: '#10b981',
    fontWeight: '600',
  },
  link: {
    color: '#10b981',
    textDecoration: 'underline',
    wordBreak: 'break-all',
  },
  button: {
    padding: '16px 32px',
    backgroundColor: '#10b981',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  buttonSecondary: {
    backgroundColor: '#222',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loadingSpinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
  },
  // Negotiation summary
  negotiationSummary: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '16px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '4px 0',
  },
  summaryLabel: {
    color: '#666',
  },
  summaryValue: {
    fontFamily: 'monospace',
  },
};

export default function PaymentPage() {
  const [step, setStep] = useState(0); // 0: upload, 1: select, 2: negotiate, 3: success
  const [uploadedImage, setUploadedImage] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [messages, setMessages] = useState([]);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [offerResult, setOfferResult] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [negotiationRound, setNegotiationRound] = useState(0);
  const [currentOffer, setCurrentOffer] = useState(0);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        setTimeout(() => {
          setMatches(MOCK_MATCHES);
          setStep(1);
        }, 1500);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    setSelectedSize(match.sizes[0] || '');
    // Default max price to asking price
    setMaxPrice(match.askingPrice.toString());
  };

  const addMessage = (type, text) => {
    setMessages(prev => [...prev, { type, text, time: new Date() }]);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const startAutonomousNegotiation = async () => {
    if (!selectedMatch || !maxPrice) return;
    
    const maxPriceNum = parseFloat(maxPrice);
    if (isNaN(maxPriceNum) || maxPriceNum <= 0) return;
    
    setStep(2);
    setIsNegotiating(true);
    setNegotiationRound(0);
    setMessages([]);
    
    // Initial system message
    addMessage('system', `🤖 Starting autonomous negotiation with ${selectedMatch.seller}`);
    await delay(500);
    addMessage('seller', `Hi! Thanks for your interest in the ${selectedMatch.name}. I'm asking ${selectedMatch.askingPrice} USDC. What's your offer?`);
    
    // Start with an offer at 80% of max price
    let currentOfferAmount = Math.round(maxPriceNum * 0.8 * 10000) / 10000;
    let round = 0;
    let negotiationActive = true;
    
    while (negotiationActive) {
      round++;
      setNegotiationRound(round);
      setCurrentOffer(currentOfferAmount);
      
      await delay(1000);
      
      // Show offer with status
      addMessage('buyer', `💰 OFFER #${round}: ${currentOfferAmount} USDC`);
      
      setIsTyping(true);
      
      try {
        const response = await fetch(`${API_URL}/seller`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item: selectedMatch.name,
            offer_amount: currentOfferAmount,
            size: selectedSize,
            asking_price: selectedMatch.askingPrice,
          }),
        });

        const data = await response.json();
        setIsTyping(false);
        
        await delay(300);

        if (data.accepted) {
          // ACCEPTED
          addMessage('seller', `✅ ACCEPTED! ${data.message}`);
          setOfferResult(data);
          addMessage('system', `🎉 Deal reached at ${data.accepted_amount} USDC after ${round} round(s)!`);
          
          await delay(1000);
          addMessage('system', '💳 Processing payment...');
          setIsTyping(true);
          
          // Send payment
          const paymentResponse = await fetch(`${API_URL}/quick-pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount_usdc: data.accepted_amount,
              offer_id: data.offer_id,
              seller_wallet: data.seller_wallet,
            }),
          });

          const paymentData = await paymentResponse.json();
          setIsTyping(false);
          setPaymentResult(paymentData);

          if (paymentData.success) {
            addMessage('system', `✅ Payment of ${data.accepted_amount} USDC sent successfully!`);
            await delay(1500);
            setStep(3);
          } else {
            addMessage('system', `❌ Payment failed: ${paymentData.error}`);
          }
          
          negotiationActive = false;
          setIsNegotiating(false);
          return;
        } else if (data.counter_offer) {
          // DECLINED with counter-offer
          addMessage('seller', `❌ DECLINED. Counter-offer: ${data.counter_offer} USDC`);
          addMessage('seller', data.message);
          
          await delay(800);
          
          if (data.counter_offer <= maxPriceNum) {
            // Counter is within our budget - accept the counter
            addMessage('system', `↔️ Counter ${data.counter_offer} USDC is within budget. Accepting...`);
            currentOfferAmount = data.counter_offer;
          } else if (currentOfferAmount < maxPriceNum) {
            // Counter is too high, raise our offer toward max
            const newOffer = Math.min(
              Math.round((currentOfferAmount * 1.1) * 10000) / 10000,
              maxPriceNum
            );
            addMessage('system', `↗️ Raising offer from ${currentOfferAmount} to ${newOffer} USDC`);
            currentOfferAmount = newOffer;
          } else {
            // We're at max - keep trying at max price
            addMessage('system', `⚠️ At max budget ${maxPriceNum} USDC. Trying again...`);
            // Keep currentOfferAmount the same
          }
        } else {
          // DECLINED without counter-offer
          addMessage('seller', `❌ DECLINED. ${data.message}`);
          
          if (currentOfferAmount < maxPriceNum) {
            const newOffer = Math.min(
              Math.round(currentOfferAmount * 1.1 * 10000) / 10000,
              maxPriceNum
            );
            await delay(500);
            addMessage('system', `↗️ Raising offer from ${currentOfferAmount} to ${newOffer} USDC`);
            currentOfferAmount = newOffer;
          } else {
            // At max, keep trying
            await delay(500);
            addMessage('system', `⚠️ At max budget. Trying again at ${maxPriceNum} USDC...`);
          }
        }
      } catch (error) {
        setIsTyping(false);
        addMessage('system', `❌ Error: ${error.message}`);
        negotiationActive = false;
        setIsNegotiating(false);
        return;
      }
    }
  };

  const resetFlow = () => {
    setStep(0);
    setUploadedImage(null);
    setMatches([]);
    setSelectedMatch(null);
    setSelectedSize('');
    setMaxPrice('');
    setMessages([]);
    setOfferResult(null);
    setPaymentResult(null);
    setIsNegotiating(false);
    setNegotiationRound(0);
    setCurrentOffer(0);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .typing-dot:nth-child(1) { animation: bounce 1.4s infinite 0s; }
        .typing-dot:nth-child(2) { animation: bounce 1.4s infinite 0.2s; }
        .typing-dot:nth-child(3) { animation: bounce 1.4s infinite 0.4s; }
        .spinner { animation: spin 1s linear infinite; }
        .pulse { animation: pulse 2s infinite; }
        .match-card:hover { transform: translateY(-4px); border-color: #333; }
        .upload-area:hover { border-color: #10b981; background-color: #0f0f0f; }
        input:focus, select:focus { border-color: #10b981 !important; }
      `}</style>

      <div style={styles.page}>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logo}>
              <div style={styles.logoIcon}>$</div>
              <h1 style={styles.title}>
                <span style={styles.titleAccent}>Snatch</span>
              </h1>
            </div>
            <p style={styles.subtitle}>Find, negotiate, and pay with USDC</p>
          </div>

          {/* Steps */}
          <div style={styles.stepsContainer}>
            {['Upload', 'Select', 'Negotiate', 'Complete'].map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    ...styles.stepDot,
                    ...(step > i ? styles.stepDotComplete : {}),
                    ...(step === i ? styles.stepDotActive : {}),
                  }} />
                  <div style={styles.stepLabel}>{label}</div>
                </div>
                {i < 3 && (
                  <div style={{
                    ...styles.stepLine,
                    ...(step > i ? styles.stepLineComplete : {}),
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Upload Image */}
          {step === 0 && (
            <div
              className="upload-area"
              style={styles.uploadArea}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              {uploadedImage ? (
                <>
                  <img src={uploadedImage} alt="Uploaded" style={styles.uploadPreview} />
                  <p style={{ ...styles.uploadSubtext, marginTop: '16px' }}>
                    Finding matches...
                  </p>
                </>
              ) : (
                <>
                  <div style={styles.uploadIcon}>📷</div>
                  <p style={styles.uploadText}>Upload an image to find matches</p>
                  <p style={styles.uploadSubtext}>
                    Click or drag and drop • JPG, PNG, WEBP
                  </p>
                </>
              )}
            </div>
          )}

          {/* Step 1: Select Match & Configure */}
          {step === 1 && (
            <>
              <div style={styles.matchesGrid}>
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="match-card"
                    style={{
                      ...styles.matchCard,
                      ...(selectedMatch?.id === match.id ? styles.matchCardSelected : {}),
                    }}
                    onClick={() => handleSelectMatch(match)}
                  >
                    <img src={match.image} alt={match.name} style={styles.matchImage} />
                    <div style={styles.matchInfo}>
                      <div style={styles.matchName}>{match.name}</div>
                      <div style={styles.matchSeller}>@{match.seller}</div>
                      <div style={styles.matchPrice}>{match.askingPrice} USDC</div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedMatch && (
                <div style={styles.configPanel}>
                  <div style={styles.configTitle}>Configure Your Offer</div>
                  <div style={styles.configGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Size</label>
                      <select
                        value={selectedSize}
                        onChange={(e) => setSelectedSize(e.target.value)}
                        style={styles.select}
                      >
                        {SIZES.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Maximum Price (USDC)</label>
                      <div style={styles.inputWrapper}>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder="0.00"
                          style={{ ...styles.input, paddingRight: '60px' }}
                        />
                        <span style={styles.inputSuffix}>USDC</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={styles.negotiationSummary}>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryLabel}>Seller's asking price</span>
                      <span style={styles.summaryValue}>{selectedMatch.askingPrice} USDC</span>
                    </div>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryLabel}>Your max budget</span>
                      <span style={{ ...styles.summaryValue, color: '#10b981' }}>{maxPrice || '—'} USDC</span>
                    </div>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryLabel}>Starting offer (~80%)</span>
                      <span style={styles.summaryValue}>
                        {maxPrice ? (parseFloat(maxPrice) * 0.8).toFixed(4) : '—'} USDC
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <button
                  style={{
                    ...styles.button,
                    ...(selectedMatch && maxPrice ? {} : styles.buttonDisabled),
                  }}
                  onClick={startAutonomousNegotiation}
                  disabled={!selectedMatch || !maxPrice}
                >
                  🤖 Start Auto-Negotiation →
                </button>
              </div>
            </>
          )}

          {/* Step 2: Autonomous Negotiation Chat */}
          {step === 2 && (
            <div style={styles.chatContainer}>
              <div style={styles.chatHeader}>
                <div style={styles.chatHeaderLeft}>
                  <div style={styles.chatAvatar}>🏪</div>
                  <div>
                    <div style={styles.chatTitle}>{selectedMatch?.seller}</div>
                    <div style={styles.chatStatus}>● Online</div>
                  </div>
                </div>
                <div style={styles.autoBadge}>
                  🤖 Auto-Negotiating
                </div>
              </div>

              <div style={styles.chatMessages}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.message,
                      ...(msg.type === 'buyer' ? styles.messageBuyer : {}),
                      ...(msg.type === 'seller' ? styles.messageSeller : {}),
                      ...(msg.type === 'system' ? styles.messageSystem : {}),
                    }}
                  >
                    {msg.text}
                    {msg.type !== 'system' && (
                      <div style={styles.messageTime}>{formatTime(msg.time)}</div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div style={styles.typingIndicator}>
                    <div className="typing-dot" style={styles.typingDot} />
                    <div className="typing-dot" style={styles.typingDot} />
                    <div className="typing-dot" style={styles.typingDot} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={styles.chatFooter}>
                {isNegotiating ? (
                  <div style={styles.negotiationStatus}>
                    <div className="spinner" style={styles.loadingSpinner} />
                    <span>Round {negotiationRound} • Current offer: {currentOffer} USDC • Max: {maxPrice} USDC</span>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary }}
                      onClick={resetFlow}
                    >
                      Start Over
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && paymentResult && (
            <div style={styles.successContainer}>
              <div style={styles.successIcon}>✓</div>
              <h2 style={styles.successTitle}>Purchase Complete!</h2>
              <p style={styles.successSubtitle}>
                You've successfully purchased {selectedMatch?.name}
              </p>

              <div style={styles.detailsCard}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Item</span>
                  <span style={styles.detailValue}>{selectedMatch?.name}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Size</span>
                  <span style={styles.detailValue}>{selectedSize}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Seller</span>
                  <span style={styles.detailValue}>@{selectedMatch?.seller}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Asking Price</span>
                  <span style={styles.detailValue}>{selectedMatch?.askingPrice} USDC</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Final Price</span>
                  <span style={{ ...styles.detailValue, ...styles.detailValueGreen }}>
                    {paymentResult.amount_usdc} USDC
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>You Saved</span>
                  <span style={{ ...styles.detailValue, ...styles.detailValueGreen }}>
                    {(selectedMatch?.askingPrice - paymentResult.amount_usdc).toFixed(4)} USDC
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Your Balance</span>
                  <span style={styles.detailValue}>
                    {paymentResult.buyer_balance_after?.toFixed(4)} USDC
                  </span>
                </div>
                <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
                  <span style={styles.detailLabel}>Transaction</span>
                  <a
                    href={paymentResult.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    View on BaseScan ↗
                  </a>
                </div>
              </div>

              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={resetFlow}
              >
                Find Another Item
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
