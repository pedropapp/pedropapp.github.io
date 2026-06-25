const form = document.getElementById('contact-form');
const msg = document.getElementById('form-msg');
const btn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.textContent = 'Sending…';
  btn.disabled = true;
  msg.className = 'form-msg';

  const data = Object.fromEntries(new FormData(form));

  try {
    const res = await fetch('https://formspree.io/f/YOUR_ID', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      msg.textContent = "Message sent — we'll be in touch soon.";
      msg.className = 'form-msg success';
      form.reset();
    } else {
      throw new Error();
    }
  } catch {
    msg.textContent = 'Something went wrong. Please email us directly.';
    msg.className = 'form-msg error';
  }

  btn.textContent = 'Send message →';
  btn.disabled = false;
});