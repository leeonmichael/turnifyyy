# Pruebas automatizadas de la aplicación web — Turnify Pro

Proyecto de pruebas con **Selenium WebDriver + JUnit 5 + Maven**, pensado para
abrirse y ejecutarse en **IntelliJ IDEA**. Automatiza los casos de prueba del
documento *Casos de Prueba — Aplicación Web Turnify Pro* (rama `final`).

Proyecto académico SENA — Ficha 3203084.

---

## 1. Requisitos

| Herramienta | Versión usada | Nota |
|---|---|---|
| JDK | 17 (Temurin) | IntelliJ debe apuntar a un JDK 17 o superior |
| Maven | 3.9 | IntelliJ trae uno incluido, no hace falta instalarlo |
| Microsoft Edge | el del sistema | Selenium Manager descarga solo el `msedgedriver` |

No hay que descargar controladores a mano: Selenium 4 los resuelve solo.

## 2. Antes de ejecutar: levantar la aplicación

Las pruebas trabajan contra la aplicación en marcha. Desde la carpeta del
proyecto (`turnifyyy`), en dos terminales:

```bash
# 1) Backend (ASGI, para que funcionen los WebSockets de tiempo real)
python -m daphne -b 127.0.0.1 -p 8000 config.asgi:application

# 2) Frontend Angular con proxy hacia el backend
cd frontend
npx ng serve --host 127.0.0.1 --port 4200 --proxy-config proxy.conf.json
```

La aplicación queda en `http://127.0.0.1:4200`. Se necesita además una cuenta de
administrador; en las pruebas se usa `qa_admin_web`, que crea el script
`crear_admin_prueba.py` de la raíz del proyecto.

## 2.1 Credenciales

La cuenta de administrador no está escrita en el código para no publicarla en el
repositorio. Antes de la primera ejecución:

```bash
cd pruebas-selenium
cp credenciales.local.properties.ejemplo credenciales.local.properties
# y completar turnify.admin.clave
```

Ese archivo está en `.gitignore`. También se puede pasar por línea de comandos:
`mvn test -Dturnify.admin.clave=...`

## 3. Cómo ejecutar desde IntelliJ IDEA

1. **File → Open…** y seleccionar la carpeta `pruebas-selenium` (o su `pom.xml`).
   IntelliJ reconoce el proyecto Maven y descarga las dependencias solo.
   El proyecto ya trae configuraciones de ejecución listas en la carpeta `.run`,
   que aparecen en la lista desplegable de arriba a la derecha: *Todas las
   pruebas*, *Todas las pruebas (viendo el navegador)* y *Solo el Test 01* como
   ejemplo de ejecución de una prueba suelta.
2. Comprobar en **File → Project Structure → Project** que el SDK sea Java 17.
3. Para ejecutar **todo el plan de pruebas**: clic derecho sobre
   `src/test/java` → **Run 'All Tests'**.
4. Para ejecutar **una sola prueba**: abrir su archivo (por ejemplo
   `Test12SolicitarTurnoPresencial`) y pulsar el triángulo verde junto al nombre
   de la clase.
5. Los resultados se ven en la ventana **Run**, con la descripción de cada
   prueba (*Test 12 - Solicitar turno presencial…*).

Para ver el navegador trabajando en lugar de ejecutarlo oculto, agregar en la
configuración de ejecución (**Modify options → Add VM options**):

```
-Dturnify.headless=false
```

## 4. Cómo ejecutar desde la terminal

```bash
mvn test                              # todo el plan de pruebas
mvn test -Dtest=Test12*               # una sola prueba
mvn test -Dturnify.headless=false     # mostrando el navegador
mvn test -Dturnify.base=http://otro-servidor:4200
```

## 5. Qué contiene cada archivo

Cada caso de prueba está en su propio archivo, numerado en el orden en que se
ejecuta. El nombre de la clase y su `@DisplayName` indican para qué es la prueba
y a qué caso del documento corresponde.

| Archivo | Para qué es |
|---|---|
| `Test01InicioSesionExitoso` | Un cliente registrado entra con sus credenciales |
| `Test02InicioSesionCamposVacios` | Exige usuario y contraseña antes de llamar al servidor |
| `Test03InicioSesionCredencialesInvalidas` | Rechaza credenciales incorrectas y debe avisarlo |
| `Test04MostrarContrasena` | El botón del ojo muestra y oculta la contraseña |
| `Test05InicioSesionConCorreo` | El acceso también funciona con el correo |
| `Test06RegistroValidacionDeCampos` | Cada dato inválido del registro muestra su mensaje |
| `Test07RegistroExitoso` | Crea una cuenta nueva y permite entrar con ella |
| `Test08RegistroUsuarioDuplicado` | Rechaza un nombre de usuario que ya existe |
| `Test09SesionPersistente` | La sesión sobrevive a recargar la página |
| `Test10CerrarSesion` | Cierra sesión y protege las rutas privadas |
| `Test11RutasProtegidasPorRol` | Cada rol solo entra a sus pantallas |
| `Test12SolicitarTurnoPresencial` | Pide un turno eligiendo tipo de atención y sede |
| `Test13PosicionEnLaCola` | Dos clientes ven su lugar en la fila |
| `Test14BloqueoDobleTurno` | Con un turno activo no se puede pedir otro |
| `Test15CancelarTurnoEnEspera` | El cliente anula su turno |
| `Test16SolicitarTurnoVirtual` | Turno virtual con prefijo W y sus documentos |
| `Test17SubirDocumentoTurnoVirtual` | Adjunta un documento y queda en revisión |
| `Test18SolicitarTurnoSinConexion` | Sin internet avisa del error y no se bloquea |
| `Test19HistorialDeTurnos` | Mis Turnos lista los turnos con sus estados |
| `Test20CancelarTurnoDesdeMisTurnos` | Cancela desde la lista del historial |
| `Test21EditarPerfil` | Guarda los cambios de nombre y teléfono |
| `Test22ChatbotPreguntasFrecuentes` | Abre TURNITY y responde las preguntas frecuentes |
| `Test23ChatbotTemaFueraDeAlcance` | Solo atiende temas del sistema de turnos |
| `Test24ChatbotAgendaElTurno` | El asistente crea el turno por el cliente |
| `Test25DashboardAdministrador` | El panel administrativo y sus seis gráficas |
| `Test26CrearEmpleadoValidaciones` | Valida los campos al crear un empleado |
| `Test27CrearEmpleados` | Crea el empleado de sede y el especialista virtual |
| `Test28EditarEmpleado` | Modifica los datos de un empleado |
| `Test29DesactivarYActivarEmpleado` | Cambia el estado de la cuenta de un empleado |
| `Test30GestionDeSedes` | Crea, edita y elimina una sede |
| `Test31ExportarReportes` | Descarga los reportes en CSV y Excel |
| `Test32GestionDeUsuarios` | Desactiva un cliente y comprueba que no puede entrar |
| `Test33PanelDeTurnosYPantalla` | Las vistas Turnos y Pantalla del administrador |
| `Test34PanelDelEmpleado` | El empleado ve la cola de su sede |
| `Test35LlamarSiguienteTurno` | Llama el turno más antiguo de la cola |
| `Test36AvisoDeLlamadoAlCliente` | El cliente y la pantalla pública ven el llamado |
| `Test37CompletarTurno` | Cierra la atención del turno en curso |
| `Test38EstadosFinalesEnElCliente` | El cliente ve su turno atendido y cancelado |
| `Test39LlamarTurnoConcretoYReagendar` | Atiende un turno puntual y le cambia la fecha |
| `Test40CancelarTurnoPorInasistencia` | Anula el turno cuando el cliente no llega |
| `Test41LlamarConLaColaVacia` | Avisa que no hay turnos en espera |
| `Test42ReagendarDesdeSuPagina` | Reagendar y marcar 'no llegó' desde su pantalla |
| `Test43UsuariosDesdeElRolEmpleado` | El empleado solo ve cuentas de clientes |
| `Test44HistorialRecienteDelPanel` | La tabla de turnos recientes del panel |
| `Test45AccesoDelEspecialistaVirtual` | El especialista entra a Turnos Virtuales |
| `Test46AtenderTurnoVirtual` | Genera el enlace de videollamada para ambos |
| `Test47RevisionDeDocumentos` | Aprueba y rechaza los documentos del cliente |
| `Test48ChatEnVivo` | Mensajes en ambos sentidos durante la atención |
| `Test49FinalizarTurnoVirtual` | Cierra la atención virtual como atendida |
| `Test50PantallaPublicaDeTurnos` | La sala de espera funciona sin iniciar sesión |
| `Test51DisenoResponsive` | La web se adapta a una pantalla de teléfono |

Los archivos se ejecutan en orden (`Test01`…`Test51`) porque unos dejan
preparados los datos de los siguientes: el administrador crea los empleados que
después inician sesión, y los clientes crean los turnos que el empleado atiende.
Cada prueba, de todos modos, crea por su cuenta lo que necesita, así que también
se puede ejecutar sola.

Clases de apoyo (no son pruebas): `Config` (parámetros), `Navegador` (abre los
Edge), `Acciones` (esperas, clics, formularios, inicio de sesión, pedir turno),
`Escenario` (precondiciones de cada prueba), `Cuentas` (cuentas de prueba) y
`Evidencia` (capturas y `resultados.json`).

## 6. Evidencias

Cada caso guarda su captura en `evidencias/` con el nombre del caso, y todos los
datos observados (códigos HTTP, mensajes, números de turno) quedan en
`evidencias/resultados.json`. Los reportes que descarga el caso CP-47 van a
`descargas/`. Esas capturas son las que se insertan en el documento de casos de
prueba.

## 7. Notas sobre los casos que fallan

Tres casos fallan por defectos reales de la aplicación, no de las pruebas. El
mensaje de la aserción explica cada uno:

- **CP-03 y CP-08**: el servidor responde correctamente (401 / 409) pero la
  pantalla no repinta el mensaje de error, porque la aplicación corre sin
  `zone.js` y esos componentes no llaman a `detectChanges()`.
- **CP-23**: la pantalla Perfil envía la actualización sin el token de sesión,
  el backend responde 401 y los cambios no se guardan.
- **CP-48**: al desactivar un usuario el cambio se aplica en el servidor, pero
  la tabla no se refresca hasta recargar la página.
