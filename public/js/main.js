function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener("DOMContentLoaded", () => {

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
        fetch('/api/specs')
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
                    statusCard.className = `status-card visible ${isGood ? 'active-sub' : 'expired-sub'}`;
                    const expText = data.plan === 'lifetime' ? 'Never (Lifetime)' : new Date(data.expiresAt).toLocaleDateString();
                    const specsLine = Array.isArray(data.specs) && data.specs.length
                        ? data.specs.map((id) => escapeHtml(String(id))).join(', ') : '';
                    const monthlyLine = data.monthlyRateUsd != null && !Number.isNaN(Number(data.monthlyRateUsd))
                        ? `$${Number(data.monthlyRateUsd).toFixed(0)} / month` : '';
                    statusCard.innerHTML = `
                        <div class="stat-row"><span class="stat-label">Plan Type:</span><span class="stat-value cap">${escapeHtml(String(data.plan || ''))}</span></div>
                        <div class="stat-row"><span class="stat-label">Status:</span><span class="stat-value ${isGood ? 'good' : 'bad'}">${data.active ? (data.isExpired ? 'Expired' : 'Active') : 'Disabled'}</span></div>
                        <div class="stat-row"><span class="stat-label">Expires:</span><span class="stat-value">${escapeHtml(expText)}</span></div>
                        ${specsLine ? `<div class="stat-row"><span class="stat-label">Specs:</span><span class="stat-value" style="text-align:right;max-width:60%">${specsLine}</span></div>` : ''}
                        ${monthlyLine ? `<div class="stat-row"><span class="stat-label">Plan rate:</span><span class="stat-value good">${escapeHtml(monthlyLine)}</span></div>` : ''}
                        ${data.email ? `<div class="stat-row"><span class="stat-label">Email on file:</span><span class="stat-value">${escapeHtml(String(data.email))}</span></div>` : ''}
                        <div class="stat-row"><span class="stat-label">Hardware Binding:</span><span class="stat-value ${data.isBound ? 'good' : ''}">${data.isBound ? 'Bound to PC' : 'Unbound (Ready for first use)'}</span></div>
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
            const checkoutModal = document.getElementById('checkoutModal');
            const checkoutBody = document.getElementById('checkoutModalBody');
            const checkoutErr = document.getElementById('checkoutModalError');
            const checkoutActions = document.getElementById('checkoutModalActions');

            // Plan config
            const plans = {
                monthly:  { label: 'Monthly — All Specs', amount: 30, months: 1 },
                '3month': { label: '3-Month — All Specs', amount: 75, months: 3 }
            };
            const p = plans[plan];
            if (!p) return;

            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';

            checkoutBody.innerHTML = `
                <div style="margin-bottom:16px;">
                    <strong style="color:var(--accent);font-size:16px;">${escapeHtml(p.label)}</strong>
                    <p style="margin-top:8px;color:var(--text-secondary);">Total: <strong style="color:var(--accent);">$${p.amount} USD</strong> for ${p.months} month${p.months > 1 ? 's' : ''}</p>
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px;">Email for license delivery</label>
                    <input type="email" id="planCheckoutEmail" class="input-box" style="text-align:left;letter-spacing:0;font-size:14px;" placeholder="you@example.com" autocomplete="email">
                </div>
            `;

            checkoutActions.innerHTML = '';
            const payNow = document.createElement('button');
            payNow.type = 'button';
            payNow.className = 'btn';
            payNow.style.flex = '1';
            payNow.textContent = 'Continue to Payment';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn-action';
            cancel.textContent = 'Cancel';
            cancel.addEventListener('click', closeModal);

            payNow.addEventListener('click', async () => {
                const email = (document.getElementById('planCheckoutEmail')?.value || '').trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    checkoutErr.textContent = 'Please enter a valid email address.';
                    checkoutErr.classList.add('is-visible');
                    return;
                }
                payNow.disabled = true;
                payNow.textContent = 'Processing...';
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
                        payNow.disabled = false;
                        payNow.textContent = 'Continue to Payment';
                        return;
                    }

                    if (data.invoiceUrl) {
                        checkoutBody.innerHTML = `
                            <p>Redirecting to NOWPayments...</p>
                            <div class="checkout-modal-summary">Order ID: <code style="color:var(--accent)">${escapeHtml(data.orderId || '')}</code></div>
                        `;
                        checkoutActions.innerHTML = '';
                        const goBtn = document.createElement('a');
                        goBtn.href = data.invoiceUrl;
                        goBtn.className = 'btn';
                        goBtn.rel = 'noopener noreferrer';
                        goBtn.textContent = 'Pay with Crypto';
                        goBtn.style.flex = '1';
                        goBtn.addEventListener('click', () => setTimeout(closeModal, 300));
                        checkoutActions.appendChild(goBtn);
                    } else {
                        const orderPayload = JSON.stringify({ plan, ref: data.orderId, email });
                        checkoutBody.innerHTML = `
                            <div class="checkout-modal-summary">Order ID: <code style="color:var(--accent)">${escapeHtml(data.orderId || '')}</code></div>
                            <p>Auto invoices are not configured. Copy the JSON below into your payment order description:</p>
                            <textarea class="checkout-json-box" readonly id="planJsonField">${escapeHtml(orderPayload)}</textarea>
                        `;
                        checkoutActions.innerHTML = '';
                        const copyBtn = document.createElement('button');
                        copyBtn.type = 'button';
                        copyBtn.className = 'btn';
                        copyBtn.textContent = 'Copy JSON';
                        copyBtn.addEventListener('click', async () => {
                            try {
                                await navigator.clipboard.writeText(document.getElementById('planJsonField').value);
                                copyBtn.textContent = 'Copied!';
                                setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 2000);
                            } catch { document.getElementById('planJsonField').select(); document.execCommand('copy'); }
                        });
                        checkoutActions.appendChild(copyBtn);
                    }
                } catch (e) {
                    checkoutErr.textContent = 'Network error — could not reach server.';
                    checkoutErr.classList.add('is-visible');
                    payNow.disabled = false;
                    payNow.textContent = 'Continue to Payment';
                }
            });

            checkoutActions.append(payNow, cancel);
            openModal();
        });
    });

    // ── Modal helpers ──
    function openModal() {
        const m = document.getElementById('checkoutModal');
        m.classList.add('is-open');
        m.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        const m = document.getElementById('checkoutModal');
        m.classList.remove('is-open');
        m.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        const err = document.getElementById('checkoutModalError');
        err.classList.remove('is-visible');
        err.textContent = '';
    }

    const checkoutClose = document.getElementById('checkoutModalClose');
    const checkoutBackdrop = document.getElementById('checkoutModalBackdrop');
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
            summaryEl.innerHTML = `${n} spec${n === 1 ? '' : 's'} × $${each} = <strong>$${n * each}</strong> / month`;
            payBtn.disabled = n === 0;
        }

        function render() {
            specGrid.innerHTML = '';
            const list = filteredSpecs();
            if (!list.length) {
                specGrid.innerHTML = '<p class="spec-empty">No specializations match your filters.</p>';
                return;
            }
            list.forEach(s => {
                const tile = document.createElement('label');
                tile.className = 'spec-tile' + (selected.has(s.id) ? ' selected' : '');
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
                specGrid.appendChild(tile);
            });
        }

        searchEl.addEventListener('input', () => render());
        if (classSelect) classSelect.addEventListener('change', () => { populateSpecOptions(); render(); });
        if (specSelect) specSelect.addEventListener('change', () => render());
        btnAll.addEventListener('click', () => { filteredSpecs().forEach(s => selected.add(s.id)); render(); updateSummary(); });
        btnClear.addEventListener('click', () => { selected.clear(); render(); updateSummary(); });

        // Per-spec checkout
        payBtn.addEventListener('click', async () => {
            const specIds = [...selected];
            const email = (emailEl.value || '').trim();
            if (!specIds.length) return;
            payBtn.disabled = true;
            payBtn.textContent = 'Starting...';

            const checkoutBody = document.getElementById('checkoutModalBody');
            const checkoutErr = document.getElementById('checkoutModalError');
            const checkoutActions = document.getElementById('checkoutModalActions');
            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';
            checkoutBody.innerHTML = '<span class="checkout-spinner"></span><span>Starting secure checkout…</span>';
            checkoutActions.innerHTML = '';
            openModal();

            try {
                const res = await fetch('/api/checkout/per-spec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ specIds, email }),
                });
                const data = await res.json();

                if (!res.ok) {
                    checkoutBody.innerHTML = '<p>Checkout could not start.</p>';
                    checkoutErr.textContent = data.error || data.detail || 'Unknown error';
                    checkoutErr.classList.add('is-visible');
                    const retry = document.createElement('button');
                    retry.type = 'button'; retry.className = 'btn-action'; retry.textContent = 'Close';
                    retry.addEventListener('click', closeModal);
                    checkoutActions.appendChild(retry);
                    return;
                }

                const currency = data.currency || 'USD';
                const summaryHtml = `
                    <p><strong>${data.specIds.length}</strong> specialization(s) × $${data.pricePerSpecUsdPerMonth || 15} = <strong style="color:var(--accent)">$${data.amountUsd}</strong> / month (${currency})</p>
                    <div class="checkout-modal-summary">Order ID: <code style="color:var(--accent)">${escapeHtml(data.orderId || '')}</code></div>
                `;

                if (data.mode === 'invoice' && data.invoiceUrl) {
                    checkoutBody.innerHTML = summaryHtml + '<p>You will be redirected to NOWPayments to complete payment in crypto.</p>';
                    const go = document.createElement('a');
                    go.href = data.invoiceUrl; go.className = 'btn'; go.rel = 'noopener noreferrer';
                    go.textContent = 'Continue to NOWPayments';
                    go.addEventListener('click', () => setTimeout(closeModal, 300));
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button'; cancelBtn.className = 'btn-action'; cancelBtn.textContent = 'Cancel';
                    cancelBtn.addEventListener('click', closeModal);
                    checkoutActions.append(go, cancelBtn);
                } else {
                    const orderPayload = JSON.stringify({ specs: data.specIds, ref: data.orderId, email: email || undefined });
                    checkoutBody.innerHTML = summaryHtml +
                        '<p>Automatic invoices are not configured. Copy the JSON below into your payment provider\'s <strong>order description</strong> field.</p>' +
                        `<textarea class="checkout-json-box" readonly id="checkoutJsonField">${escapeHtml(orderPayload)}</textarea>`;
                    const copy = document.createElement('button');
                    copy.type = 'button'; copy.className = 'btn'; copy.textContent = 'Copy order JSON';
                    copy.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(document.getElementById('checkoutJsonField').value);
                            copy.textContent = 'Copied';
                            setTimeout(() => { copy.textContent = 'Copy order JSON'; }, 2000);
                        } catch { document.getElementById('checkoutJsonField').select(); document.execCommand('copy'); }
                    });
                    const closeBtn = document.createElement('button');
                    closeBtn.type = 'button'; closeBtn.className = 'btn-action'; closeBtn.textContent = 'Close';
                    closeBtn.addEventListener('click', closeModal);
                    checkoutActions.append(copy, closeBtn);
                }
            } catch (e) {
                console.error(e);
                checkoutBody.innerHTML = '<p>Could not reach the server.</p>';
                checkoutErr.textContent = 'Network error';
                checkoutErr.classList.add('is-visible');
                const closeBtn = document.createElement('button');
                closeBtn.type = 'button'; closeBtn.className = 'btn-action'; closeBtn.textContent = 'Close';
                closeBtn.addEventListener('click', closeModal);
                checkoutActions.appendChild(closeBtn);
            } finally {
                updateSummary();
                payBtn.textContent = 'Continue to Payment';
            }
        });

        // Load spec catalog
        fetch('/api/specs')
            .then(r => r.json())
            .then(data => {
                catalog = data;
                populateClassOptions();
                populateSpecOptions();
                render();
                updateSummary();

                const price = catalog.pricePerSpecUsdPerMonth || 15;
                const heroPrice = document.getElementById('heroPriceDisplay');
                if (heroPrice) heroPrice.textContent = `$${price}`;
                const specPrice = document.getElementById('specPriceDisplay');
                if (specPrice) specPrice.textContent = `$${price} USD`;
                const faq1 = document.getElementById('faqPriceDisplay1');
                if (faq1) faq1.textContent = `$${price}`;
            })
            .catch(() => {
                specGrid.innerHTML = '<p class="spec-hint" style="text-align:center">Could not load specialization list.</p>';
            });

        if (emailEl) {
            emailEl.addEventListener('input', () => { emailEl.value = emailEl.value.trimStart(); });
        }
    }

});
