function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener("DOMContentLoaded", () => {
    // Hero floating particles
    const heroParticles = document.getElementById('heroParticles');
    if (heroParticles) {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'hero-particle';
            const size = Math.random() * 4 + 2;
            const posX = Math.random() * 100;
            const duration = Math.random() * 10 + 10;
            const delay = Math.random() * 10;
            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${posX}%;
                background: ${Math.random() > 0.5 ? 'rgba(0, 221, 179, 0.4)' : 'rgba(100, 80, 255, 0.4)'};
                box-shadow: 0 0 ${size * 2}px ${particle.style.background};
                animation-duration: ${duration}s;
                animation-delay: ${delay}s;
            `;
            heroParticles.appendChild(particle);
        }
    }

    const runtimePricing = {
        perSpecMonthly: 15,
        monthlyAll: 30,
        threeMonthAll: 75,
    };
    const runtimeCheckout = {
        invoiceEnabled: false,
        paypalEnabled: false,
        testMode: false,
    };

    fetch('/api/checkout/config', { cache: 'no-store' })
        .then(r => r.json())
        .then(cfg => {
            runtimeCheckout.invoiceEnabled = !!cfg.invoiceEnabled;
            runtimeCheckout.paypalEnabled = !!cfg.paypalEnabled;
            runtimeCheckout.testMode = !!cfg.testMode;
        })
        .catch(() => {});

    // ── Smooth Scrolling for in-page anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#' || href.length < 2) return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // ── FAQ Accordion ──
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });

    // ── Intersection Observer for scroll animations ──
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
    const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                animateOnScroll.unobserve(entry.target);
            }
        });
    }, observerOptions);


    document.querySelectorAll('.bento-card, .pricing-card, .faq-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        animateOnScroll.observe(el);
    });

    // ── Hero floating particles ──
    const heroEl = document.querySelector('.hero');
    if (heroEl) {
        const particleContainer = document.createElement('div');
        particleContainer.className = 'hero-particles';
        particleContainer.setAttribute('aria-hidden', 'true');
        heroEl.appendChild(particleContainer);

        for (let i = 0; i < 35; i++) {
            const p = document.createElement('span');
            p.className = 'hero-particle';
            const size = 2 + Math.random() * 4;
            const x = Math.random() * 100;
            const delay = Math.random() * 8;
            const duration = 6 + Math.random() * 10;
            const glow = Math.random() > 0.6 ? 'rgba(0,221,179,0.6)' : 'rgba(100,160,255,0.5)';
            p.style.cssText = `
                width:${size}px; height:${size}px;
                left:${x}%;
                bottom: -10px;
                animation-delay:${delay}s;
                animation-duration:${duration}s;
                background: ${glow};
                box-shadow: 0 0 ${size * 3}px ${glow};
            `;
            particleContainer.appendChild(p);
        }

        // ── Hero floating spec icons ──
        fetch('/api/specs', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (!data.specs || !data.specs.length) return;
                const shuffled = [...data.specs].sort(() => Math.random() - 0.5);
                const picks = shuffled.slice(0, 14);
                const orbitContainer = document.createElement('div');
                orbitContainer.className = 'hero-spec-orbits';
                orbitContainer.setAttribute('aria-hidden', 'true');
                heroEl.appendChild(orbitContainer);

                picks.forEach((spec, i) => {
                    const orb = document.createElement('div');
                    orb.className = 'hero-spec-orb';
                    const img = document.createElement('img');
                    img.src = spec.image;
                    img.alt = '';
                    img.width = 48;
                    img.height = 48;
                    img.loading = 'lazy';
                    img.onerror = function() { orb.style.display = 'none'; };
                    orb.appendChild(img);

                    // Scatter positions around the hero edges
                    const positions = [
                        { top: '8%', left: '2%' },
                        { top: '18%', right: '3%' },
                        { top: '35%', left: '-2%' },
                        { bottom: '30%', right: '0%' },
                        { bottom: '12%', left: '5%' },
                        { top: '55%', left: '1%' },
                        { bottom: '45%', right: '2%' },
                        { top: '5%', left: '42%' },
                        { bottom: '8%', right: '35%' },
                        { top: '70%', left: '3%' },
                        { bottom: '5%', left: '25%' },
                        { top: '12%', left: '22%' },
                        { bottom: '20%', right: '8%' },
                        { top: '42%', right: '5%' },
                    ];
                    const pos = positions[i % positions.length];
                    Object.assign(orb.style, pos);

                    const size = 48 + Math.random() * 24;
                    const delay = Math.random() * 6;
                    const dur = 12 + Math.random() * 10;
                    orb.style.width = size + 'px';
                    orb.style.height = size + 'px';
                    orb.style.animationDelay = delay + 's';
                    orb.style.animationDuration = dur + 's';

                    orbitContainer.appendChild(orb);
                });
            })
            .catch(() => {});
    }

    // ── Dashboard Logic ──
    const dashInput = document.getElementById('dashKeyInput');
    const dashBtn = document.getElementById('dashCheckBtn');

    if (dashInput && dashBtn) {
        dashInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (v.length > 16) v = v.substring(0, 16);
            e.target.value = v.match(/.{1,4}/g)?.join('-') || v;
        });

        dashBtn.addEventListener('click', async () => {
            const key = dashInput.value.trim();
            const keyBody = key.replace(/-/g, '');
            if (keyBody.length !== 16) {
                alert("Please enter a valid license key (XXXX-XXXX-XXXX-XXXX).");
                return;
            }
            dashBtn.textContent = "Checking...";
            dashBtn.disabled = true;
            try {
                const res = await fetch(`/api/status/${encodeURIComponent(key)}`);
                const data = await res.json();
                const statusCard = document.getElementById('statusCard');
                if (!res.ok) {
                    statusCard.className = 'status-card expired-sub visible';
                    statusCard.innerHTML = `<h3 class="status-error-title">${escapeHtml(data.error || 'Key Not Found')}</h3>`;
                } else {
                    const isGood = data.active && !data.isExpired;
                    const expiryStarted = data.expiryStarted;
                    let expText;
                    if (data.plan === 'lifetime') {
                        expText = 'Never (Lifetime)';
                    } else if (!expiryStarted) {
                        if (data._customDuration) {
                            const { value, unit } = data._customDuration;
                            expText = `Timer starts on first bind (${value} ${unit})`;
                        } else {
                            const dur = data.pendingDurationMonths || 1;
                            expText = `Timer starts on first bind (${dur} month${dur > 1 ? 's' : ''})`;
                        }
                    } else {
                        expText = new Date(data.expiresAt).toLocaleDateString();
                    }
                    const specsLine = Array.isArray(data.specs) && data.specs.length
                        ? data.specs.map((id) => escapeHtml(String(id))).join(', ') : '';
                    const monthlyLine = data.monthlyRateUsd != null && !Number.isNaN(Number(data.monthlyRateUsd))
                        ? `$${Number(data.monthlyRateUsd).toFixed(0)} / month` : '';
                    const boundText = data.isBound
                        ? `Bound to PC${data.boundAt ? ' — ' + new Date(data.boundAt).toLocaleDateString() : ''}`
                        : 'Unbound (Ready for first use)';
                    statusCard.innerHTML = `
                        <div class="stat-row"><span class="stat-label">Plan Type:</span><span class="stat-value cap">${escapeHtml(String(data.plan || ''))}</span></div>
                        <div class="stat-row"><span class="stat-label">Status:</span><span class="stat-value ${isGood ? 'good' : 'bad'}">${data.active ? (data.isExpired ? 'Expired' : 'Active') : 'Disabled'}</span></div>
                        <div class="stat-row"><span class="stat-label">Expires:</span><span class="stat-value ${!expiryStarted && data.plan !== 'lifetime' ? 'good' : ''}">${escapeHtml(expText)}</span></div>
                        ${specsLine ? `<div class="stat-row"><span class="stat-label">Specs:</span><span class="stat-value" style="text-align:right;max-width:60%">${specsLine}</span></div>` : ''}
                        ${monthlyLine ? `<div class="stat-row"><span class="stat-label">Plan rate:</span><span class="stat-value good">${escapeHtml(monthlyLine)}</span></div>` : ''}
                        ${data.email ? `<div class="stat-row"><span class="stat-label">Email on file:</span><span class="stat-value">${escapeHtml(String(data.email))}</span></div>` : ''}
                        <div class="stat-row"><span class="stat-label">Hardware Binding:</span><span class="stat-value ${data.isBound ? 'good' : ''}">${boundText}</span></div>
                        ${data.isBound ? `<div class="status-card-actions"><button type="button" class="btn btn-outline btn-sm" id="hwid-reset-hint-btn">Request HWID Reset</button></div>` : ''}
                    `;
                    const hintBtn = document.getElementById('hwid-reset-hint-btn');
                    if (hintBtn) {
                        hintBtn.addEventListener('click', () => {
                            alert('To prevent abuse, automated HWID resets are disabled. Please open a ticket in Discord to request a manual HWID reset.');
                        });
                    }
                }
            } catch (err) {
                console.error(err);
                alert("Could not connect to the server.");
            } finally {
                dashBtn.textContent = "Check License";
                dashBtn.disabled = false;
            }
        });
    }

    // ── Payment method picker helper ──
    function buildPaymentPickerHTML(planLabel, amountUsd, emailVal, showCrypto = true, cryptoDisabled = false) {
        const processingFee = Math.round(amountUsd * 0.029 * 100) / 100;
        const subtotal = (amountUsd - processingFee).toFixed(2);
        const cryptoCard = showCrypto ? `
                <div class="ck-pay-card ck-pay-card--crypto ${cryptoDisabled ? 'ck-pay-card--disabled' : ''}" id="pmCardNowpay" ${cryptoDisabled ? '' : 'tabindex="0" role="button" aria-pressed="false"'}>
                    <div class="ck-pay-check">
                        <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <div class="ck-pay-icon ck-pay-icon--crypto">
                        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                            <circle cx="16" cy="16" r="12" fill="rgba(0,221,179,0.15)" stroke="#00DDB3" stroke-width="1.5"/>
                            <path d="M11 21l3-10 4 8 3-6" stroke="#00DDB3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="ck-pay-info">
                        <div class="ck-pay-name">Crypto</div>
                        <div class="ck-pay-desc">${cryptoDisabled ? 'Not available for per-spec plans.' : 'Pay anonymously. 200+ coins accepted.'}</div>
                        <div class="ck-pay-chips">
                            <span class="ck-pay-chip ck-pay-chip--crypto">BTC</span>
                            <span class="ck-pay-chip ck-pay-chip--crypto">ETH</span>
                            <span class="ck-pay-chip ck-pay-chip--crypto">USDT</span>
                            <span class="ck-pay-chip ck-pay-chip--crypto">+200</span>
                        </div>
                    </div>
                    ${cryptoDisabled ? '<div class="ck-pay-badge">Unavailable</div>' : ''}
                </div>` : '';
        return `
        <div class="ck-pay-step">
            <div class="ck-order-summary">
                <div class="ck-order-info">
                    <div class="ck-order-label">${escapeHtml(planLabel)}</div>
                    <div class="ck-order-email">License delivered to <strong>${escapeHtml(emailVal)}</strong></div>
                </div>
                <div class="ck-order-amount">$${amountUsd}</div>
            </div>
            <div class="ck-review-summary">
                <div class="ck-review-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    Order Summary
                </div>
                <div class="ck-review-row">
                    <span>Subtotal</span>
                    <span>$${subtotal}</span>
                </div>
                <div class="ck-review-row">
                    <span>Processing fee</span>
                    <span>$${processingFee.toFixed(2)}</span>
                </div>
                <div class="ck-review-row ck-review-total">
                    <span>Total</span>
                    <span>$${amountUsd}</span>
                </div>
            </div>
            <p class="ck-pay-intro">Choose your preferred payment method</p>
            <div class="ck-pay-grid">
                <div class="ck-pay-card ck-pay-card--paypal" id="pmCardPaypal" tabindex="0" role="button" aria-pressed="false">
                    <div class="ck-pay-check">
                        <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <div class="ck-pay-icon ck-pay-icon--paypal">
                        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                            <path d="M26 11.5c0 4.14-3.36 7.5-7.5 7.5H14l-1.5 8H8l3-18h9c3.31 0 6 2.69 6 5.5z" fill="#009CDE"/>
                            <path d="M23 8c0 3.86-3.14 7-7 7H11.5L10 22.5H5.5L8 6h10c2.76 0 5 2.24 5 5z" fill="#003087"/>
                        </svg>
                    </div>
                    <div class="ck-pay-info">
                        <div class="ck-pay-name">PayPal</div>
                        <div class="ck-pay-desc">Fast &amp; secure. Pay with balance, bank or card.</div>
                        <div class="ck-pay-chips">
                            <span class="ck-pay-chip ck-pay-chip--paypal">Bank</span>
                            <span class="ck-pay-chip ck-pay-chip--paypal">Card</span>
                            <span class="ck-pay-chip ck-pay-chip--paypal">Balance</span>
                        </div>
                    </div>
                </div>
                ${cryptoCard}
            </div>
        </div>`;
    }

    function initPaymentPicker(planLabel, email, amountUsd, onPaypal, onCrypto) {
        const cardPaypal = document.getElementById('pmCardPaypal');
        const cardNowpay = document.getElementById('pmCardNowpay');
        const confirmBtn = document.getElementById('pmConfirmBtn');
        let chosen = null;

        function selectCard(card, provider) {
            const cards = [cardPaypal, cardNowpay].filter(c => c);
            cards.forEach(c => {
                c.classList.remove('ck-pay-card--selected');
                c.setAttribute('aria-pressed', 'false');
            });
            card.classList.add('ck-pay-card--selected');
            card.setAttribute('aria-pressed', 'true');
            chosen = provider;
            if (confirmBtn) {
                confirmBtn.classList.add('ck-confirm--ready');
                confirmBtn.textContent = provider === 'paypal' ? '→  Pay with PayPal' : '→  Pay with Crypto';
            }
        }

        if (cardPaypal) {
            cardPaypal.addEventListener('click', () => selectCard(cardPaypal, 'paypal'));
            cardPaypal.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(cardPaypal, 'paypal'); } });
        }
        if (cardNowpay) {
            cardNowpay.addEventListener('click', () => selectCard(cardNowpay, 'crypto'));
            cardNowpay.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(cardNowpay, 'crypto'); } });
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (!chosen) return;
                
                // Show confirmation step before payment
                const checkoutBody = document.getElementById('ckBody');
                const checkoutActions = document.getElementById('ckActions');
                const checkoutErr = document.getElementById('ckError');
                checkoutErr.classList.remove('is-visible');
                
                const providerName = chosen === 'paypal' ? 'PayPal' : 'Crypto';
                const providerIcon = chosen === 'paypal' 
                    ? '<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M26 11.5c0 4.14-3.36 7.5-7.5 7.5H14l-1.5 8H8l3-18h9c3.31 0 6 2.69 6 5.5z" fill="#009CDE"/><path d="M23 8c0 3.86-3.14 7-7 7H11.5L10 22.5H5.5L8 6h10c2.76 0 5 2.24 5 5z" fill="#003087"/></svg>'
                    : '<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" fill="rgba(0,221,179,0.15)" stroke="#00DDB3" stroke-width="1.5"/><path d="M11 21l3-10 4 8 3-6" stroke="#00DDB3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                
                checkoutBody.innerHTML = `
                    <div class="ck-confirm-step">
                        <div class="ck-confirm-icon">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                <circle cx="24" cy="24" r="22" stroke="url(#confirmGrad)" stroke-width="1.5" fill="none"/>
                                <path d="M16 24l5 5 11-11" stroke="url(#confirmGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <defs><linearGradient id="confirmGrad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#00DDB3"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>
                            </svg>
                        </div>
                        <h3 class="ck-confirm-title">Confirm Your Order</h3>
                        <p class="ck-confirm-subtitle">Please review your order details before proceeding to payment</p>
                        
                        <div class="ck-confirm-details">
                            <div class="ck-confirm-row">
                                <span class="ck-confirm-label">Plan</span>
                                <span class="ck-confirm-value">${escapeHtml(planLabel)}</span>
                            </div>
                            <div class="ck-confirm-row">
                                <span class="ck-confirm-label">Email</span>
                                <span class="ck-confirm-value">${escapeHtml(email)}</span>
                            </div>
                            <div class="ck-confirm-row">
                                <span class="ck-confirm-label">Payment Method</span>
                                <span class="ck-confirm-value ck-confirm-provider">${providerIcon} ${providerName}</span>
                            </div>
                            <div class="ck-confirm-row ck-confirm-total">
                                <span class="ck-confirm-label">Total Amount</span>
                                <span class="ck-confirm-value">$${amountUsd}</span>
                            </div>
                        </div>
                        
                        <div class="ck-confirm-note">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                            By clicking "Confirm & Pay", you agree to our terms of service. Your license key will be sent to your email after payment.
                        </div>
                    </div>
                `;
                setActiveStep(4);
                checkoutActions.innerHTML = '';
                
                const confirmPayBtn = document.createElement('button');
                confirmPayBtn.type = 'button';
                confirmPayBtn.className = 'btn';
                confirmPayBtn.style.flex = '1';
                confirmPayBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Confirm & Pay →`;
                
                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'btn-action';
                backBtn.textContent = '← Back';
                
                confirmPayBtn.addEventListener('click', () => {
                    if (chosen === 'paypal') onPaypal();
                    else if (chosen === 'crypto') onCrypto();
                });
                
                backBtn.addEventListener('click', () => {
                    checkoutBody.innerHTML = buildPaymentPickerHTML(planLabel, amountUsd, email, true, false);
                    setActiveStep(2);
                    checkoutActions.innerHTML = '';
                    const newConfirmBtn = document.createElement('button');
                    newConfirmBtn.type = 'button';
                    newConfirmBtn.id = 'pmConfirmBtn';
                    newConfirmBtn.className = 'btn ck-confirm';
                    newConfirmBtn.textContent = 'Select a payment method';
                    checkoutActions.appendChild(newConfirmBtn);
                    initPaymentPicker(planLabel, email, amountUsd, onPaypal, onCrypto);
                });
                
                checkoutActions.append(confirmPayBtn, backBtn);
            });
        }
    }

    // ── Pricing plan buttons (Monthly / 3-Month) ──
    document.querySelectorAll('.pricing-buy-btn').forEach(btn => {
        const plan = btn.dataset.plan;
        if (plan === 'per_spec') {
            btn.addEventListener('click', () => {
                const specStore = document.getElementById('spec-store');
                if (!specStore) return;
                const isVisible = specStore.classList.contains('section-store--visible');
                if (isVisible) {
                    specStore.classList.remove('section-store--visible');
                    btn.textContent = 'Select Specs →';
                } else {
                    specStore.classList.add('section-store--visible');
                    btn.textContent = 'Hide Specs ↑';
                    setTimeout(() => {
                        specStore.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 350);
                }
            });
            return;
        }

        btn.addEventListener('click', () => {
            const checkoutBody = document.getElementById('ckBody');
            const checkoutErr = document.getElementById('ckError');
            const checkoutActions = document.getElementById('ckActions');

            const plans = {
                monthly:  { label: 'Monthly — All Specs', amount: runtimePricing.monthlyAll, months: 1 },
                '3month': { label: '3-Month — All Specs', amount: runtimePricing.threeMonthAll, months: 3 }
            };
            const p = plans[plan];
            if (!p) return;

            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';

            // Step 1: Email collection
            const processingFee = Math.round(p.amount * 0.029 * 100) / 100; // 2.9%
            const totalAmount = (p.amount + processingFee).toFixed(2);
            checkoutBody.innerHTML = `
                <div class="ck-details-step">
                    <div class="ck-plan-card">
                        <div class="ck-plan-icon">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <rect x="4" y="8" width="24" height="16" rx="3" stroke="url(#planGrad)" stroke-width="2" fill="none"/>
                                <circle cx="16" cy="16" r="4" stroke="url(#planGrad)" stroke-width="2" fill="none"/>
                                <line x1="4" y1="12" x2="28" y2="12" stroke="url(#planGrad)" stroke-width="1.5"/>
                                <defs><linearGradient id="planGrad" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#00DDB3"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>
                            </svg>
                        </div>
                        <div class="ck-plan-info">
                            <div class="ck-plan-name">${escapeHtml(p.label)}</div>
                            <div class="ck-plan-duration">${p.months} month${p.months > 1 ? 's' : ''} access — All Specs included</div>
                        </div>
                        <div class="ck-plan-price">
                            <span class="ck-price-value">$${p.amount}</span>
                            <span class="ck-price-unit">USD</span>
                        </div>
                    </div>
                    <div class="ck-breakdown">
                        <div class="ck-breakdown-row">
                            <span class="ck-breakdown-label">Subtotal</span>
                            <span class="ck-breakdown-value">$${p.amount.toFixed(2)}</span>
                        </div>
                        <div class="ck-breakdown-row">
                            <span class="ck-breakdown-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                                Processing fee (2.9%)
                            </span>
                            <span class="ck-breakdown-value">$${processingFee.toFixed(2)}</span>
                        </div>
                        <div class="ck-breakdown-row ck-breakdown-total">
                            <span class="ck-breakdown-label">Total</span>
                            <span class="ck-breakdown-value">$${totalAmount}</span>
                        </div>
                    </div>
                    <div class="ck-field-group">
                        <label class="ck-field-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            Email for license delivery
                        </label>
                        <input type="email" id="planCheckoutEmail" class="ck-input" placeholder="you@example.com" autocomplete="email">
                        <p class="ck-field-hint">Your license key will be sent to this email address</p>
                    </div>
                </div>
            `;

            checkoutActions.innerHTML = '';

            const continueBtn = document.createElement('button');
            continueBtn.type = 'button';
            continueBtn.className = 'btn';
            continueBtn.style.flex = '1';
            continueBtn.textContent = 'Choose Payment Method →';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-action';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', closeModal);

            continueBtn.addEventListener('click', () => {
                const email = (document.getElementById('planCheckoutEmail')?.value || '').trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    checkoutErr.textContent = 'Please enter a valid email address.';
                    checkoutErr.classList.add('is-visible');
                    return;
                }
                checkoutErr.classList.remove('is-visible');
                checkoutErr.textContent = '';

                // Step 2: Payment method picker
                checkoutBody.innerHTML = buildPaymentPickerHTML(p.label, p.amount, email);
                setActiveStep(2);
                checkoutActions.innerHTML = '';

                const confirmBtn = document.createElement('button');
                confirmBtn.type = 'button';
                confirmBtn.id = 'pmConfirmBtn';
                confirmBtn.className = 'btn ck-confirm';
                confirmBtn.textContent = 'Select a payment method';
                checkoutActions.appendChild(confirmBtn);

                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'btn-action';
                backBtn.textContent = '← Back';
                backBtn.addEventListener('click', () => {
                    btn.click(); // re-open step 1
                });
                checkoutActions.appendChild(backBtn);

                initPaymentPicker(
                    p.label,
                    email,
                    p.amount,
                    // PayPal
                    async () => {
                        if (!runtimeCheckout.paypalEnabled) {
                            checkoutErr.textContent = 'PayPal is temporarily unavailable.';
                            checkoutErr.classList.add('is-visible');
                            return;
                        }
                        confirmBtn.disabled = true;
                        checkoutErr.classList.remove('is-visible');

                        // Test mode — simulate payment instantly
                        if (runtimeCheckout.testMode) {
                            confirmBtn.textContent = 'Processing test payment…';
                            try {
                                const createRes = await fetch('/api/checkout/test-create', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ kind: 'plan', plan, email }),
                                });
                                const createData = await createRes.json();
                                if (!createRes.ok) {
                                    checkoutErr.textContent = createData.error || 'Test checkout failed';
                                    checkoutErr.classList.add('is-visible');
                                    confirmBtn.disabled = false;
                                    confirmBtn.textContent = '→  Pay with PayPal';
                                    return;
                                }
                                // Auto-capture (simulate payment)
                                const capRes = await fetch('/api/checkout/test-capture', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId: createData.orderId }),
                                });
                                const capData = await capRes.json();
                                if (!capRes.ok) {
                                    checkoutErr.textContent = capData.error || capData.detail || 'Test fulfillment failed';
                                    checkoutErr.classList.add('is-visible');
                                    confirmBtn.disabled = false;
                                    confirmBtn.textContent = '→  Pay with PayPal';
                                    return;
                                }
                                checkoutBody.innerHTML = `
                                    <div class="ck-success">
                                        <div class="ck-success-icon">
                                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                                <circle cx="24" cy="24" r="22" stroke="#00DDB3" stroke-width="2" fill="rgba(0,221,179,0.08)"/>
                                                <path d="M14 24l7 7 13-13" stroke="#00DDB3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </div>
                                        <h3 class="ck-success-title">Payment Successful!</h3>
                                        <p class="ck-success-text">Your license key has been generated and sent to your email.</p>
                                        <div class="ck-key-box">
                                            <span class="ck-key-label">License Key</span>
                                            <code class="ck-key-value">${escapeHtml(capData.licenseKey || '')}</code>
                                        </div>
                                        <p class="ck-test-badge">🧪 Test Mode — no real payment was processed</p>
                                    </div>`;
                                setActiveStep(4);
                                checkoutActions.innerHTML = '';
                                const closeBtn = document.createElement('button');
                                closeBtn.className = 'btn';
                                closeBtn.textContent = 'Done';
                                closeBtn.style.flex = '1';
                                closeBtn.addEventListener('click', closeModal);
                                checkoutActions.appendChild(closeBtn);
                            } catch {
                                checkoutErr.textContent = 'Network error — could not reach server.';
                                checkoutErr.classList.add('is-visible');
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '→  Pay with PayPal';
                            }
                            return;
                        }

                        confirmBtn.textContent = 'Redirecting to PayPal…';
                        try {
                            const res = await fetch('/api/checkout/paypal/create-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ kind: 'plan', plan, email }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.approveUrl) {
                                checkoutErr.textContent = data.error || data.detail || 'PayPal checkout failed';
                                checkoutErr.classList.add('is-visible');
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '→  Pay with PayPal';
                                return;
                            }
                            checkoutBody.innerHTML = `<p style="color:var(--text-secondary)">Redirecting to PayPal…</p><div class="ck-order-id">Order ID: <code>${escapeHtml(data.orderId || '')}</code></div>`;
                            checkoutActions.innerHTML = '';
                            const goBtn = document.createElement('a');
                            goBtn.href = data.approveUrl;
                            goBtn.className = 'btn';
                            goBtn.rel = 'noopener noreferrer';
                            goBtn.textContent = 'Continue to PayPal →';
                            goBtn.style.flex = '1';
                            goBtn.addEventListener('click', () => setTimeout(closeModal, 300));
                            checkoutActions.appendChild(goBtn);
                        } catch {
                            checkoutErr.textContent = 'Network error — could not reach server.';
                            checkoutErr.classList.add('is-visible');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = '→  Pay with PayPal';
                        }
                    },
                    // Crypto / NOWPayments
                    async () => {
                        confirmBtn.disabled = true;
                        confirmBtn.textContent = 'Creating invoice…';
                        checkoutErr.classList.remove('is-visible');
                        try {
                            const res = await fetch('/api/checkout/plan', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ plan, email, months: p.months, amountUsd: p.amount })
                            });
                            const data = await res.json();
                            if (!res.ok) {
                                checkoutErr.textContent = data.error || 'Checkout failed';
                                checkoutErr.classList.add('is-visible');
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '→  Pay with Crypto';
                                return;
                            }
                            if (data.invoiceUrl) {
                                checkoutBody.innerHTML = `<p style="color:var(--text-secondary)">Redirecting to NOWPayments…</p><div class="ck-order-id">Order ID: <code>${escapeHtml(data.orderId || '')}</code></div>`;
                                checkoutActions.innerHTML = '';
                                const goBtn = document.createElement('a');
                                goBtn.href = data.invoiceUrl;
                                goBtn.className = 'btn';
                                goBtn.rel = 'noopener noreferrer';
                                goBtn.textContent = 'Pay with Crypto →';
                                goBtn.style.flex = '1';
                                goBtn.addEventListener('click', () => setTimeout(closeModal, 300));
                                checkoutActions.appendChild(goBtn);
                            } else {
                                const orderPayload = JSON.stringify({ plan, ref: data.orderId, email });
                                checkoutBody.innerHTML = `<div class="ck-order-id">Order ID: <code>${escapeHtml(data.orderId || '')}</code></div><p style="color:var(--text-secondary);font-size:13px;margin-top:8px;">Auto invoices not configured. Copy the JSON below into your payment description.</p><textarea class="ck-json-box" readonly id="planJsonField">${escapeHtml(orderPayload)}</textarea>`;
                                checkoutActions.innerHTML = '';
                                const copyBtn = document.createElement('button');
                                copyBtn.type = 'button'; copyBtn.className = 'btn'; copyBtn.textContent = 'Copy JSON';
                                copyBtn.addEventListener('click', async () => {
                                    try { await navigator.clipboard.writeText(document.getElementById('planJsonField').value); copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 2000); }
                                    catch { document.getElementById('planJsonField').select(); document.execCommand('copy'); }
                                });
                                checkoutActions.appendChild(copyBtn);
                            }
                        } catch {
                            checkoutErr.textContent = 'Network error — could not reach server.';
                            checkoutErr.classList.add('is-visible');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = '→  Pay with Crypto';
                        }
                    }
                );
            });

            checkoutActions.append(continueBtn, cancelBtn);
            openModal();
        });
    });

    // ── Modal helpers ──
    function setActiveStep(n) {
        const steps = document.querySelectorAll('.ck-step');
        const lines = document.querySelectorAll('.ck-step-line');
        steps.forEach((s, i) => {
            const stepNum = Number(s.getAttribute('data-step'));
            s.classList.toggle('is-active', stepNum <= n);
            s.classList.toggle('is-done', stepNum < n);
        });
        lines.forEach((l, i) => {
            l.classList.toggle('is-active', (i + 1) < n);
        });
    }

    function openModal() {
        const m = document.getElementById('checkoutModal');
        m.classList.add('is-open');
        m.setAttribute('aria-hidden', 'false');
        setActiveStep(1);
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        const m = document.getElementById('checkoutModal');
        m.classList.remove('is-open');
        m.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        const err = document.getElementById('ckError');
        err.classList.remove('is-visible');
        err.textContent = '';
    }

    const checkoutClose = document.getElementById('ckClose');
    const checkoutBackdrop = document.getElementById('ckBackdrop');
    if (checkoutClose) checkoutClose.addEventListener('click', closeModal);
    if (checkoutBackdrop) checkoutBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // ── Per-spec monthly store ──
    const specGrid = document.getElementById('specGrid');
    if (specGrid) {
        const searchEl = document.getElementById('specSearch');
        const summaryEl = document.getElementById('specSummary');
        const payBtn = document.getElementById('specPayBtn');
        const emailEl = document.getElementById('specCheckoutEmail');
        const btnAll = document.getElementById('specSelectAll');
        const btnClear = document.getElementById('specClearAll');
        const classSelect = document.getElementById('specClassSelect');
        const specSelect = document.getElementById('specSpecSelect');

        let catalog = { pricePerSpecUsdPerMonth: 15, currency: 'USD', specs: [] };
        const selected = new Set();
        const ownedSpecs = new Set(); // specs already active on the entered license key
        const expiredSpecs = new Set(); // specs that are expired on the entered license key
        const specExpiries = new Map(); // specId -> expiresAt string
        let validatedLicenseKey = null;
        const knownClasses = [
            'Death Knight','Demon Hunter','Evoker','Hunter','Mage','Monk',
            'Paladin','Priest','Rogue','Shaman','Warlock','Warrior','Druid',
        ];

        function getClassFromSpec(spec) {
            const label = String(spec.label || '').trim();
            const id = String(spec.id || '');
            for (const cls of knownClasses) {
                if (label.endsWith(cls)) return cls;
                const compact = cls.replace(/\s+/g, '');
                if (id.toLowerCase().includes(compact.toLowerCase())) return cls;
            }
            return 'Unknown';
        }

        function getSpecOnlyLabel(spec) {
            const label = String(spec.label || '').trim();
            const cls = getClassFromSpec(spec);
            if (cls !== 'Unknown' && label.endsWith(cls)) {
                return label.slice(0, Math.max(0, label.length - cls.length)).trim();
            }
            return label;
        }

        function priceEach() { return catalog.pricePerSpecUsdPerMonth || 15; }

        function filteredSpecs() {
            const q = (searchEl.value || '').trim().toLowerCase();
            const selCls = classSelect ? classSelect.value : '';
            const selSpec = specSelect ? specSelect.value : '';
            return catalog.specs.filter((s) => {
                if (q && !s.label.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
                if (selCls && getClassFromSpec(s) !== selCls) return false;
                if (selSpec && s.id !== selSpec) return false;
                return true;
            });
        }

        function populateClassOptions() {
            if (!classSelect) return;
            const classes = Array.from(new Set(catalog.specs.map(s => getClassFromSpec(s))))
                .filter(c => c && c !== 'Unknown').sort();
            classSelect.innerHTML = '<option value="">All classes</option>';
            classes.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls; opt.textContent = cls;
                classSelect.appendChild(opt);
            });
        }

        function populateSpecOptions() {
            if (!specSelect) return;
            const selCls = classSelect ? classSelect.value : '';
            const prev = specSelect.value;
            const specs = catalog.specs
                .filter(s => !selCls || getClassFromSpec(s) === selCls)
                .sort((a, b) => String(a.label).localeCompare(String(b.label)));
            specSelect.innerHTML = '<option value="">All specs</option>';
            specs.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                const cls = getClassFromSpec(s);
                const specName = getSpecOnlyLabel(s);
                opt.textContent = specName && cls !== 'Unknown' ? `${specName} (${cls})` : s.label;
                specSelect.appendChild(opt);
            });
            specSelect.value = (prev && specs.some(s => s.id === prev)) ? prev : '';
        }

        function updateSummary() {
            const n = selected.size;
            const each = priceEach();
            const newOnly = [...selected].filter(id => !ownedSpecs.has(id) && !expiredSpecs.has(id)).length;
            const renewOnly = [...selected].filter(id => expiredSpecs.has(id)).length;
            const ownedCount = [...selected].filter(id => ownedSpecs.has(id)).length;
            const payableCount = newOnly + renewOnly;
            const totalPayable = payableCount * each;
            const parts = [];
            if (newOnly > 0) parts.push(`${newOnly} new`);
            if (renewOnly > 0) parts.push(`${renewOnly} renewal${renewOnly !== 1 ? 's' : ''}`);
            if (ownedCount > 0) parts.push(`${ownedCount} already owned`);
            if (payableCount > 0) {
                summaryEl.innerHTML = `${parts.join(', ')} × $${each} = <strong>$${totalPayable}</strong> / month`;
            } else if (n > 0) {
                summaryEl.innerHTML = `${n} spec${n === 1 ? '' : 's'} selected — <span class="spec-owned-note">all already owned</span>`;
            } else {
                summaryEl.innerHTML = `0 specs × $${each} = <strong>$0</strong> / month`;
            }
            payBtn.disabled = payableCount === 0;
        }

        function render() {
            specGrid.innerHTML = '';
            const list = filteredSpecs();
            if (!list.length) {
                specGrid.innerHTML = '<p class="spec-empty">No specializations match your filters.</p>';
                return;
            }
            list.forEach(s => {
                const isOwned = ownedSpecs.has(s.id);
                const isExpired = expiredSpecs.has(s.id);
                const tile = document.createElement('label');
                tile.className = 'spec-tile' + (selected.has(s.id) ? ' selected' : '') + (isOwned ? ' spec-tile--owned' : '') + (isExpired ? ' spec-tile--expired' : '');
                tile.dataset.specId = s.id;

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'spec-tile-input';
                cb.checked = selected.has(s.id);
                cb.setAttribute('aria-label', `Subscribe: ${s.label}`);
                cb.addEventListener('change', () => {
                    if (cb.checked) selected.add(s.id); else selected.delete(s.id);
                    tile.classList.toggle('selected', selected.has(s.id));
                    updateSummary();
                });

                const media = document.createElement('div');
                media.className = 'spec-tile-media';
                media.setAttribute('aria-hidden', 'true');

                const img = document.createElement('img');
                img.src = s.image; img.alt = ''; img.width = 80; img.height = 80;
                img.loading = 'lazy'; img.decoding = 'async';
                img.onerror = function () {
                    this.style.opacity = '0.25';
                    media.classList.add('spec-tile-media--broken');
                };
                media.appendChild(img);

                const span = document.createElement('span');
                span.className = 'spec-tile-label';
                span.textContent = s.label;

                tile.append(cb, media, span);

                if (isExpired) {
                    const badge = document.createElement('span');
                    badge.className = 'spec-tile-expired-badge';
                    const expDate = specExpiries.get(s.id) ? new Date(specExpiries.get(s.id)).toLocaleDateString() : '';
                    badge.textContent = expDate ? `Expired ${expDate}` : 'Expired';
                    tile.appendChild(badge);
                } else if (isOwned) {
                    const badge = document.createElement('span');
                    badge.className = 'spec-tile-owned-badge';
                    const expDate = specExpiries.get(s.id) ? new Date(specExpiries.get(s.id)).toLocaleDateString() : '';
                    badge.textContent = expDate ? `✓ Active until ${expDate}` : '✓ Owned';
                    tile.appendChild(badge);
                }

                specGrid.appendChild(tile);
            });
        }

        searchEl.addEventListener('input', () => render());
        if (classSelect) classSelect.addEventListener('change', () => { populateSpecOptions(); render(); });
        if (specSelect) specSelect.addEventListener('change', () => render());
        btnAll.addEventListener('click', () => { filteredSpecs().forEach(s => selected.add(s.id)); render(); updateSummary(); });
        btnClear.addEventListener('click', () => { selected.clear(); render(); updateSummary(); });

        // ── License key toggle & validation ──
        const keyToggle = document.getElementById('specKeyToggle');
        const keyPanel = document.getElementById('specKeyPanel');
        const keyInput = document.getElementById('specKeyInput');
        const keyStatus = document.getElementById('specKeyStatus');
        let keyValidationTimer = null;

        if (keyToggle && keyPanel) {
            keyToggle.addEventListener('click', () => {
                const isVisible = keyPanel.style.display !== 'none';
                if (isVisible) {
                    keyPanel.style.display = 'none';
                    keyToggle.textContent = 'Already have a license key? Add specs →';
                    // Reset owned state
                    ownedSpecs.clear();
                    expiredSpecs.clear();
                    specExpiries.clear();
                    validatedLicenseKey = null;
                    keyInput.value = '';
                    keyStatus.innerHTML = '';
                    render();
                    updateSummary();
                } else {
                    keyPanel.style.display = '';
                    keyToggle.textContent = 'Cancel adding to existing key';
                    keyInput.focus();
                }
            });
        }

        if (keyInput) {
            keyInput.addEventListener('input', () => {
                let v = keyInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                if (v.length > 16) v = v.substring(0, 16);
                keyInput.value = v.match(/.{1,4}/g)?.join('-') || v;

                clearTimeout(keyValidationTimer);
                const raw = v.replace(/-/g, '');
                if (raw.length === 16) {
                    keyStatus.innerHTML = '<span class="spec-key-checking">Validating…</span>';
                    keyValidationTimer = setTimeout(async () => {
                        try {
                            const res = await fetch('/api/license/validate-for-add-specs', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ key: keyInput.value }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.eligible) {
                                keyStatus.innerHTML = `<span class="spec-key-error">${escapeHtml(data.error || 'Invalid key')}</span>`;
                                ownedSpecs.clear();
                                expiredSpecs.clear();
                                specExpiries.clear();
                                validatedLicenseKey = null;
                            } else {
                                ownedSpecs.clear();
                                expiredSpecs.clear();
                                specExpiries.clear();
                                const activeIds = Array.isArray(data.activeSpecIds) ? data.activeSpecIds : [];
                                const expiredIds = Array.isArray(data.expiredSpecIds) ? data.expiredSpecIds : [];
                                const specDetails = Array.isArray(data.specs) ? data.specs : [];
                                activeIds.forEach(id => ownedSpecs.add(String(id)));
                                expiredIds.forEach(id => expiredSpecs.add(String(id)));
                                specDetails.forEach(s => {
                                    if (s.id && s.expiresAt) specExpiries.set(String(s.id), s.expiresAt);
                                });
                                validatedLicenseKey = data.key;
                                const activeCount = ownedSpecs.size;
                                const expiredCount = expiredSpecs.size;
                                const expDate = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : 'N/A';
                                let statusHtml = `<span class="spec-key-valid">✓ Valid — ${activeCount} active`;
                                if (expiredCount > 0) statusHtml += `, ${expiredCount} expired`;
                                statusHtml += `</span>`;
                                keyStatus.innerHTML = statusHtml;
                                // Pre-fill email if available
                                if (data.email && !emailEl.value.trim()) {
                                    emailEl.value = data.email;
                                }
                            }
                        } catch {
                            keyStatus.innerHTML = '<span class="spec-key-error">Network error</span>';
                            ownedSpecs.clear();
                            expiredSpecs.clear();
                            specExpiries.clear();
                            validatedLicenseKey = null;
                        }
                        render();
                        updateSummary();
                    }, 500);
                } else if (raw.length > 0) {
                    keyStatus.innerHTML = '<span class="spec-key-hint">Enter full key: XXXX-XXXX-XXXX-XXXX</span>';
                    ownedSpecs.clear();
                    expiredSpecs.clear();
                    specExpiries.clear();
                    validatedLicenseKey = null;
                    render();
                    updateSummary();
                } else {
                    keyStatus.innerHTML = '';
                    ownedSpecs.clear();
                    expiredSpecs.clear();
                    specExpiries.clear();
                    validatedLicenseKey = null;
                    render();
                    updateSummary();
                }
            });
        }

        // Per-spec checkout — Step 1: validate email, Step 2: method picker
        payBtn.addEventListener('click', () => {
            const allSpecIds = [...selected];
            if (!allSpecIds.length) return;
            const email = (emailEl.value || '').trim();

            const checkoutBody = document.getElementById('ckBody');
            const checkoutErr = document.getElementById('ckError');
            const checkoutActions = document.getElementById('ckActions');
            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                checkoutErr.textContent = 'Please enter a valid email address before continuing.';
                checkoutErr.classList.add('is-visible');
                emailEl.focus();
                return;
            }

            // Only send specs not already owned (active) on the license; expired specs can be renewed
            const newSpecIds = allSpecIds.filter(id => !ownedSpecs.has(id));
            if (!newSpecIds.length) {
                checkoutErr.textContent = 'All selected specs are already active on your license.';
                checkoutErr.classList.add('is-visible');
                return;
            }

            const each = priceEach();
            const total = newSpecIds.length * each;
            const isAddSpecs = !!validatedLicenseKey;
            const planLabel = isAddSpecs
                ? `Add ${newSpecIds.length} Spec${newSpecIds.length !== 1 ? 's' : ''} to License`
                : `${newSpecIds.length} Spec${newSpecIds.length !== 1 ? 's' : ''} — Per-Spec Monthly`;

            checkoutBody.innerHTML = buildPaymentPickerHTML(planLabel, total, email, true, true);
            setActiveStep(2);
            checkoutActions.innerHTML = '';

            if (isAddSpecs) {
                const addNote = document.createElement('div');
                addNote.className = 'ck-add-specs-note';
                addNote.innerHTML = `Adding to license: <code>${escapeHtml(validatedLicenseKey)}</code>`;
                checkoutBody.querySelector('.ck-pay-step').appendChild(addNote);
            }

            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.id = 'pmConfirmBtn';
            confirmBtn.className = 'btn ck-confirm';
            confirmBtn.textContent = 'Select a payment method';
            checkoutActions.appendChild(confirmBtn);

            const closeBtn2 = document.createElement('button');
            closeBtn2.type = 'button';
            closeBtn2.className = 'btn-action';
            closeBtn2.textContent = 'Cancel';
            closeBtn2.addEventListener('click', closeModal);
            checkoutActions.appendChild(closeBtn2);

            openModal();

            initPaymentPicker(
                planLabel,
                email,
                total,
                // PayPal
                async () => {
                    if (!runtimeCheckout.paypalEnabled) {
                        checkoutErr.textContent = 'PayPal is temporarily unavailable.';
                        checkoutErr.classList.add('is-visible');
                        return;
                    }
                    confirmBtn.disabled = true;
                    checkoutErr.classList.remove('is-visible');

                    // Test mode — simulate payment instantly
                    if (runtimeCheckout.testMode) {
                        confirmBtn.textContent = 'Processing test payment…';
                        try {
                            const body = { kind: 'per_spec', specIds: newSpecIds, email };
                            if (validatedLicenseKey) body.licenseKey = validatedLicenseKey;
                            const createRes = await fetch('/api/checkout/test-create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                            });
                            const createData = await createRes.json();
                            if (!createRes.ok) {
                                checkoutErr.textContent = createData.error || 'Test checkout failed';
                                checkoutErr.classList.add('is-visible');
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '→  Pay with PayPal';
                                return;
                            }
                            const capRes = await fetch('/api/checkout/test-capture', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: createData.orderId }),
                            });
                            const capData = await capRes.json();
                            if (!capRes.ok) {
                                checkoutErr.textContent = capData.error || capData.detail || 'Test fulfillment failed';
                                checkoutErr.classList.add('is-visible');
                                confirmBtn.disabled = false;
                                confirmBtn.textContent = '→  Pay with PayPal';
                                return;
                            }
                            checkoutBody.innerHTML = `
                                <div style="text-align:center;padding:20px 0;">
                                    <div style="font-size:40px;margin-bottom:10px;">✅</div>
                                    <h3 style="color:var(--accent);margin:0 0 8px;">Test Payment Successful!</h3>
                                    <p style="color:var(--text-secondary);margin:0 0 12px;">Your license key has been generated and sent to your email.</p>
                                    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:monospace;font-size:14px;color:var(--accent);word-break:break-all;">${escapeHtml(capData.licenseKey || '')}</div>
                                    <p style="color:var(--text-muted);font-size:12px;margin-top:8px;">🧪 Test Mode — no real payment was processed</p>
                                </div>`;
                            checkoutActions.innerHTML = '';
                            const closeBtn = document.createElement('button');
                            closeBtn.className = 'btn';
                            closeBtn.textContent = 'Done';
                            closeBtn.style.flex = '1';
                            closeBtn.addEventListener('click', closeModal);
                            checkoutActions.appendChild(closeBtn);
                        } catch {
                            checkoutErr.textContent = 'Network error — could not reach server.';
                            checkoutErr.classList.add('is-visible');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = '→  Pay with PayPal';
                        }
                        return;
                    }

                    confirmBtn.textContent = 'Redirecting to PayPal…';
                    try {
                        const body = { kind: 'per_spec', specIds: newSpecIds, email };
                        if (validatedLicenseKey) body.licenseKey = validatedLicenseKey;
                        const res = await fetch('/api/checkout/paypal/create-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.approveUrl) {
                            checkoutErr.textContent = data.error || data.detail || 'PayPal checkout failed';
                            checkoutErr.classList.add('is-visible');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = '→  Pay with PayPal';
                            return;
                        }
                        location.href = data.approveUrl;
                    } catch {
                        checkoutErr.textContent = 'Network error — could not reach server.';
                        checkoutErr.classList.add('is-visible');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '→  Pay with PayPal';
                    }
                },
                // Crypto / NOWPayments (disabled for per-spec)
                async () => {
                    checkoutErr.textContent = 'Crypto payment is not available for per-spec plans.';
                    checkoutErr.classList.add('is-visible');
                }
            );
        });

        // Load spec catalog
        fetch('/api/specs', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                catalog = data;
                runtimePricing.perSpecMonthly = Number(catalog.pricePerSpecUsdPerMonth || 15);
                runtimePricing.monthlyAll = Number(catalog.priceMonthlyAll || 30);
                runtimePricing.threeMonthAll = Number(catalog.price3MonthAll || 75);

                populateClassOptions();
                populateSpecOptions();
                render();
                updateSummary();

                const price = runtimePricing.perSpecMonthly;
                const heroPrice = document.getElementById('heroPriceDisplay');
                if (heroPrice) heroPrice.textContent = `$${price}`;
                const specPrice = document.getElementById('specPriceDisplay');
                if (specPrice) specPrice.textContent = `$${price} USD`;
                const faq1 = document.getElementById('faqPriceDisplay1');
                if (faq1) faq1.textContent = `$${price}`;

                const monthlyPriceEl = document.getElementById('priceMonthlyDisplay');
                if (monthlyPriceEl) monthlyPriceEl.textContent = `$${runtimePricing.monthlyAll}`;
                const threeMonthPriceEl = document.getElementById('price3MonthDisplay');
                if (threeMonthPriceEl) threeMonthPriceEl.textContent = `$${runtimePricing.threeMonthAll}`;
                const threeMonthSaveEl = document.getElementById('price3MonthSaveDisplay');
                if (threeMonthSaveEl) {
                    const save = Math.max(0, runtimePricing.monthlyAll * 3 - runtimePricing.threeMonthAll);
                    const effective = (runtimePricing.threeMonthAll / 3).toFixed(0);
                    threeMonthSaveEl.style.opacity = '1';
                    threeMonthSaveEl.innerHTML = `Save $${save} — <strong>$${effective}/mo</strong>`;
                }

                // Update FAQ prices
                const faqMonthly = document.getElementById('faqMonthlyPrice');
                if (faqMonthly) faqMonthly.textContent = `$${runtimePricing.monthlyAll}`;
                const faq3Month = document.getElementById('faq3MonthPrice');
                if (faq3Month) faq3Month.textContent = `$${runtimePricing.threeMonthAll}`;
                const faq3MonthSave = document.getElementById('faq3MonthSavePrice');
                if (faq3MonthSave) {
                    const effective = (runtimePricing.threeMonthAll / 3).toFixed(0);
                    faq3MonthSave.textContent = `$${effective}`;
                }
            })
            .catch(() => {
                specGrid.innerHTML = '<p class="spec-hint" style="text-align:center">Could not load specialization list.</p>';
            });

        if (emailEl) {
            emailEl.addEventListener('input', () => { emailEl.value = emailEl.value.trimStart(); });
        }
    }

});
