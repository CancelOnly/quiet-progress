const form = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const button = document.getElementById('loginButton');
const errorBox = document.getElementById('loginError');
const nextInput = document.querySelector('input[name="next"]');

function setError(message) {
  errorBox.textContent = message || '';
}

async function doLogin() {
  const password = passwordInput.value;
  const next = nextInput ? nextInput.value : '/';

  if (!password) {
    setError('Digite a senha.');
    passwordInput.focus();
    return;
  }

  button.disabled = true;
  button.textContent = 'Entrando...';
  setError('');

  try {
    const response = await fetch('/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ password, next }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || 'Senha inválida.');
      button.disabled = false;
      button.textContent = 'Entrar';
      return;
    }

    window.location.href = payload.next || '/';
  } catch (error) {
    setError('Falha ao conectar no servidor. Verifique a rede/IP.');
    button.disabled = false;
    button.textContent = 'Entrar';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  doLogin();
});

passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    doLogin();
  }
});

window.addEventListener('pageshow', () => {
  button.disabled = false;
  button.textContent = 'Entrar';
});
