/* ==========================================
   SISTEMA DE AUTENTICACIÓN (LOGIN)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya hay una sesión activa guardada en el navegador
    const session = localStorage.getItem('np_session');
    if (session) {
        const userData = JSON.parse(session);
        iniciarDashboard(userData.nombre);
        return;
    }

    // Lógica del Botón de Login
    const btnLogin = document.getElementById('btn-login');
    
    btnLogin.addEventListener('click', () => {
        const userValue = document.getElementById('login-email').value.trim();
        const passValue = document.getElementById('login-password').value.trim();
        const errorMsg = document.getElementById('login-error');

        if (!userValue || !passValue) {
            mostrarError("Por favor, completa todos los campos.");
            return;
        }

        // Cambiar estado del botón a "Cargando"
        btnLogin.innerText = "Verificando...";
        btnLogin.disabled = true;

        // Descargar la base de datos de Accesos (Google Sheets)
        Papa.parse(DB_URLS.accesos, {
            download: true,
            header: true,
            complete: function(results) {
                const usuarios = results.data;
                let usuarioValido = null;

                // Buscar si el usuario y contraseña coinciden
                for (let i = 0; i < usuarios.length; i++) {
                    if (usuarios[i].Usuario === userValue && usuarios[i].Contraseña === passValue) {
                        usuarioValido = usuarios[i];
                        break;
                    }
                }

                if (usuarioValido) {
                    // Login Exitoso: Guardar sesión y entrar
                    localStorage.setItem('np_session', JSON.stringify({
                        nombre: usuarioValido.Nombre,
                        usuario: usuarioValido.Usuario
                    }));
                    iniciarDashboard(usuarioValido.Nombre);
                } else {
                    // Login Fallido
                    mostrarError("Credenciales incorrectas.");
                    btnLogin.innerText = "Acceder al Sistema";
                    btnLogin.disabled = false;
                }
            },
            error: function(err) {
                mostrarError("Error de conexión. Intenta de nuevo.");
                btnLogin.innerText = "Acceder al Sistema";
                btnLogin.disabled = false;
            }
        });
    });

    function mostrarError(mensaje) {
        const errorMsg = document.getElementById('login-error');
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${mensaje}`;
        errorMsg.style.display = 'block';
    }
});

function iniciarDashboard(nombreUsuario) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'block';
    document.getElementById('welcome-message').innerText = `Bienvenido, ${nombreUsuario}`;
    
    // Dispara la descarga de los 7 CSVs de datos
    if(typeof loadAllData === 'function') {
        loadAllData(); 
    }
}
