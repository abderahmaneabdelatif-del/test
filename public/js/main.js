function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener("DOMContentLoaded", () => {
    
    // ── Smooth Scrolling for in-page anchors (skip bare "#")
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
            
            // Close all
            faqItems.forEach(i => i.classList.remove('active'));
            
            // Open clicked if it wasn't active
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ── Dashboard Logic ──
    const dashInput = document.getElementById('dashKeyInput');
    const dashBtn = document.getElementById('dashCheckBtn');
    
    if (dashInput && dashBtn) {
        
        // Auto-format key input with dashes
        dashInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (v.length > 16) v = v.substring(0, 16);
            let formatted = v.match(/.{1,4}/g)?.join('-') || v;
            e.target.value = formatted;
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
                    const specsLine =
                        Array.isArray(data.specs) && data.specs.length
                            ? data.specs.map((id) => escapeHtml(String(id))).join(', ')
                            : '';
                    const monthlyLine =
                        data.monthlyRateUsd != null && !Number.isNaN(Number(data.monthlyRateUsd))
                            ? `$${Number(data.monthlyRateUsd).toFixed(0)} / month`
                            : '';

                    statusCard.innerHTML = `
                        <div class="stat-row">
                            <span class="stat-label">Plan Type:</span>
                            <span class="stat-value cap">${escapeHtml(String(data.plan || ''))}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Status:</span>
                            <span class="stat-value ${isGood ? 'good' : 'bad'}">${data.active ? (data.isExpired ? 'Expired' : 'Active') : 'Disabled'}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Expires:</span>
                            <span class="stat-value">${escapeHtml(expText)}</span>
                        </div>
                        ${specsLine ? `<div class="stat-row"><span class="stat-label">Specs:</span><span class="stat-value" style="text-align:right;max-width:60%">${specsLine}</span></div>` : ''}
                        ${monthlyLine ? `<div class="stat-row"><span class="stat-label">Plan rate:</span><span class="stat-value good">${escapeHtml(monthlyLine)}</span></div>` : ''}
                        ${data.email ? `<div class="stat-row"><span class="stat-label">Email on file:</span><span class="stat-value">${escapeHtml(String(data.email))}</span></div>` : ''}
                        <div class="stat-row">
                            <span class="stat-label">Hardware Binding:</span>
                            <span class="stat-value ${data.isBound ? 'good' : ''}">${data.isBound ? 'Bound to PC' : 'Unbound (Ready for first use)'}</span>
                        </div>
                        ${data.isBound ? `
                        <div class="status-card-actions">
                            <button type="button" class="btn btn-outline btn-sm" id="hwid-reset-hint-btn">Request HWID Reset</button>
                        </div>
                        ` : ''}
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

    // ── Per-spec monthly store (index only) ──
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

        let catalog = { pricePerSpecUsdPerMonth: 6, currency: 'USD', specs: [] };
        const selected = new Set();
        const knownClasses = [
            'Death Knight',
            'Demon Hunter',
            'Evoker',
            'Hunter',
            'Mage',
            'Monk',
            'Paladin',
            'Priest',
            'Rogue',
            'Shaman',
            'Warlock',
            'Warrior',
            'Druid',
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

        function priceEach() {
            return catalog.pricePerSpecUsdPerMonth || 6;
        }

        function filteredSpecs() {
            const q = (searchEl.value || '').trim().toLowerCase();
            const selectedClass = classSelect ? classSelect.value : '';
            const selectedSpec = specSelect ? specSelect.value : '';

            return catalog.specs.filter((s) => {
                if (q && !s.label.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
                if (selectedClass && getClassFromSpec(s) !== selectedClass) return false;
                if (selectedSpec && s.id !== selectedSpec) return false;
                return true;
            });
        }

        function populateClassOptions() {
            if (!classSelect) return;
            const classes = Array.from(new Set(catalog.specs.map((s) => getClassFromSpec(s))))
                .filter((c) => c && c !== 'Unknown')
                .sort((a, b) => a.localeCompare(b));
            classSelect.innerHTML = '<option value="">All classes</option>';
            classes.forEach((cls) => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                classSelect.appendChild(opt);
            });
        }

        function populateSpecOptions() {
            if (!specSelect) return;
            const selectedClass = classSelect ? classSelect.value : '';
            const previous = specSelect.value;
            const specs = catalog.specs
                .filter((s) => !selectedClass || getClassFromSpec(s) === selectedClass)
                .sort((a, b) => String(a.label).localeCompare(String(b.label)));
            specSelect.innerHTML = '<option value="">All specs</option>';
            specs.forEach((s) => {
                const opt = document.createElement('option');
                opt.value = s.id;
                const cls = getClassFromSpec(s);
                const specName = getSpecOnlyLabel(s);
                opt.textContent = specName && cls !== 'Unknown' ? `${specName} (${cls})` : s.label;
                specSelect.appendChild(opt);
            });
            if (previous && specs.some((s) => s.id === previous)) {
                specSelect.value = previous;
            } else {
                specSelect.value = '';
            }
        }

        function updateSummary() {
            const n = selected.size;
            const each = priceEach();
            const total = n * each;
            summaryEl.innerHTML = `${n} spec${n === 1 ? '' : 's'} × $${each} = <strong>$${total}</strong> / month`;
            payBtn.disabled = n === 0;
        }

        function render() {
            specGrid.innerHTML = '';
            const list = filteredSpecs();
            if (list.length === 0) {
                specGrid.innerHTML =
                    '<p class="spec-empty">No specializations match your filters.</p>';
                return;
            }

            list.forEach((s) => {

                const tile = document.createElement('label');
                tile.className = 'spec-tile' + (selected.has(s.id) ? ' selected' : '');
                tile.dataset.specId = s.id;

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'spec-tile-input';
                cb.checked = selected.has(s.id);
                cb.setAttribute('aria-label', `Subscribe: ${s.label}`);
                cb.addEventListener('change', () => {
                    if (cb.checked) selected.add(s.id);
                    else selected.delete(s.id);
                    tile.classList.toggle('selected', selected.has(s.id));
                    updateSummary();
                });

                const media = document.createElement('div');
                media.className = 'spec-tile-media';
                media.setAttribute('aria-hidden', 'true');

                const img = document.createElement('img');
                img.src = s.image;
                img.alt = '';
                img.width = 80;
                img.height = 80;
                img.loading = 'lazy';
                img.decoding = 'async';
                img.onerror = function () {
                    this.style.opacity = '0.25';
                    this.alt = '';
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
        if (classSelect) {
            classSelect.addEventListener('change', () => {
                populateSpecOptions();
                render();
            });
        }
        if (specSelect) {
            specSelect.addEventListener('change', () => {
                render();
            });
        }
        btnAll.addEventListener('click', () => {
            filteredSpecs().forEach((s) => selected.add(s.id));
            render();
            updateSummary();
        });
        btnClear.addEventListener('click', () => {
            selected.clear();
            render();
            updateSummary();
        });

        const checkoutModal = document.getElementById('checkoutModal');
        const checkoutBody = document.getElementById('checkoutModalBody');
        const checkoutErr = document.getElementById('checkoutModalError');
        const checkoutActions = document.getElementById('checkoutModalActions');
        const checkoutClose = document.getElementById('checkoutModalClose');
        const checkoutBackdrop = document.getElementById('checkoutModalBackdrop');

        function openCheckoutModal() {
            checkoutModal.classList.add('is-open');
            checkoutModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeCheckoutModal() {
            checkoutModal.classList.remove('is-open');
            checkoutModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';
        }

        checkoutClose.addEventListener('click', closeCheckoutModal);
        checkoutBackdrop.addEventListener('click', closeCheckoutModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && checkoutModal.classList.contains('is-open')) closeCheckoutModal();
        });

        payBtn.addEventListener('click', async () => {
            const specIds = [...selected];
            const email = (emailEl.value || '').trim();
            if (!specIds.length) return;
            payBtn.disabled = true;
            payBtn.textContent = 'Starting...';
            checkoutErr.classList.remove('is-visible');
            checkoutErr.textContent = '';
            checkoutBody.innerHTML =
                '<span class="checkout-spinner"></span><span>Starting secure checkout…</span>';
            checkoutActions.innerHTML = '';
            openCheckoutModal();

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
                    retry.type = 'button';
                    retry.className = 'btn-action';
                    retry.textContent = 'Close';
                    retry.addEventListener('click', closeCheckoutModal);
                    checkoutActions.appendChild(retry);
                    return;
                }

                const currency = data.currency || 'USD';
                const summaryHtml = `
                    <p><strong>${data.specIds.length}</strong> specialization(s) × $${data.pricePerSpecUsdPerMonth || 6} = <strong style="color:var(--accent)">$${data.amountUsd}</strong> / month (${currency})</p>
                    <div class="checkout-modal-summary">Order ID: <code style="color:var(--accent)">${escapeHtml(data.orderId || '')}</code></div>
                `;

                if (data.mode === 'invoice' && data.invoiceUrl) {
                    checkoutBody.innerHTML =
                        summaryHtml + '<p>You will be redirected to NOWPayments to complete payment in crypto.</p>';
                    const go = document.createElement('a');
                    go.href = data.invoiceUrl;
                    go.className = 'btn';
                    go.rel = 'noopener noreferrer';
                    go.textContent = 'Continue to NOWPayments';
                    go.addEventListener('click', () => {
                        setTimeout(closeCheckoutModal, 300);
                    });
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.className = 'btn-action';
                    cancel.textContent = 'Cancel';
                    cancel.addEventListener('click', closeCheckoutModal);
                    checkoutActions.append(go, cancel);
                } else {
                    const orderPayload = {
                        specs: data.specIds,
                        ref: data.orderId,
                        email: email || undefined,
                    };
                    const jsonLine = JSON.stringify(orderPayload);
                    checkoutBody.innerHTML =
                        summaryHtml +
                        '<p>Automatic invoices are not configured. Copy the JSON below into your payment provider’s <strong>order description</strong> field, then pay the amount shown.</p>' +
                        `<textarea class="checkout-json-box" readonly id="checkoutJsonField">${escapeHtml(jsonLine)}</textarea>` +
                        (data.message ? `<p class="spec-hint" style="margin-top:12px">${escapeHtml(data.message)}</p>` : '');

                    const copy = document.createElement('button');
                    copy.type = 'button';
                    copy.className = 'btn';
                    copy.textContent = 'Copy order JSON';
                    copy.addEventListener('click', async () => {
                        const ta = document.getElementById('checkoutJsonField');
                        try {
                            await navigator.clipboard.writeText(ta.value);
                            copy.textContent = 'Copied';
                            setTimeout(() => { copy.textContent = 'Copy order JSON'; }, 2000);
                        } catch {
                            ta.select();
                            document.execCommand('copy');
                        }
                    });
                    const close = document.createElement('button');
                    close.type = 'button';
                    close.className = 'btn-action';
                    close.textContent = 'Close';
                    close.addEventListener('click', closeCheckoutModal);
                    checkoutActions.append(copy, close);
                }
            } catch (e) {
                console.error(e);
                checkoutBody.innerHTML = '<p>Could not reach the server.</p>';
                checkoutErr.textContent = 'Network error';
                checkoutErr.classList.add('is-visible');
                const close = document.createElement('button');
                close.type = 'button';
                close.className = 'btn-action';
                close.textContent = 'Close';
                close.addEventListener('click', closeCheckoutModal);
                checkoutActions.appendChild(close);
            } finally {
                updateSummary();
                payBtn.textContent = 'Continue to payment';
            }
        });

        fetch('/api/specs')
            .then((r) => r.json())
            .then((data) => {
                catalog = data;
                populateClassOptions();
                populateSpecOptions();
                render();
                updateSummary();

                const price = catalog.pricePerSpecUsdPerMonth || 6;
                const heroPrice = document.getElementById('heroPriceDisplay');
                if (heroPrice) heroPrice.textContent = `$${price} USD`;
                const faq1 = document.getElementById('faqPriceDisplay1');
                if (faq1) faq1.textContent = `$${price}`;
                const faq2 = document.getElementById('faqPriceDisplay2');
                if (faq2) faq2.textContent = `$${price}`;
            })
            .catch(() => {
                specGrid.innerHTML = '<p class="spec-hint" style="text-align:center">Could not load specialization list.</p>';
            });

        if (emailEl) {
            emailEl.addEventListener('input', () => {
                emailEl.value = emailEl.value.trimStart();
            });
        }
    }

});
