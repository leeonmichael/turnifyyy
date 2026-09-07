package com.turnify.pruebas;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.nio.file.Path;
import java.util.List;

public final class Escenario {

    private Escenario() { }

    public static WebDriver navegadorSinSesion() {
        return Navegador.escritorio();
    }

    public static WebDriver cliente() {
        WebDriver driver = Navegador.escritorio();
        Acciones.ir(driver, "/login");
        Acciones.iniciarSesion(driver, Cuentas.asegurarCliente(driver), Config.CLIENTE_CLAVE);
        return driver;
    }

    public static WebDriver segundoCliente() {
        WebDriver driver = Navegador.escritorio();
        Acciones.ir(driver, "/login");
        Acciones.iniciarSesion(driver, Cuentas.asegurarSegundoCliente(driver), Config.CLIENTE_CLAVE);
        return driver;
    }

    public static WebDriver administrador() {
        WebDriver driver = Navegador.escritorio();
        Acciones.iniciarSesion(driver, Config.ADMIN_USUARIO, Config.ADMIN_CLAVE);
        return driver;
    }

    public static WebDriver empleado() {
        prepararEmpleados();
        WebDriver driver = Navegador.escritorio();
        Acciones.iniciarSesion(driver, Cuentas.empleadoPresencial(), Config.EMP_CLAVE);
        Acciones.esperar(4000);
        return driver;
    }

    public static WebDriver especialistaVirtual() {
        prepararEmpleados();
        WebDriver driver = Navegador.escritorio();
        Acciones.iniciarSesion(driver, Cuentas.empleadoVirtual(), Config.EMP_CLAVE);
        Acciones.esperar(3000);
        return driver;
    }

    public static void prepararEmpleados() {
        if (Evidencia.nota("empleadoPresencial") != null && Evidencia.nota("empleadoVirtual") != null) {
            return;
        }
        WebDriver admin = administrador();
        try {
            Cuentas.asegurarEmpleados(admin, sede(admin));
            Evidencia.nota("empleadoPresencial", Config.EMP_PRESENCIAL);
            Evidencia.nota("empleadoVirtual", Config.EMP_VIRTUAL);
        } finally {
            Navegador.cerrar(admin);
        }
    }

    public static java.util.Map<String, String> datosNuevoCliente() {
        String s = Cuentas.sufijo();
        java.util.Map<String, String> datos = new java.util.LinkedHashMap<>();
        datos.put("full_name", "Cliente QA Web");
        datos.put("cedula", "10" + s + "0011");
        datos.put("phone", "31" + s + "0022");
        datos.put("email", "qa_cli" + s + "@correo.com");
        datos.put("username", "qa_cli" + s);
        datos.put("password", Config.CLIENTE_CLAVE);
        datos.put("confirm_password", Config.CLIENTE_CLAVE);
        datos.put("accept_terms", "true");
        return datos;
    }

    public static void diligenciarRegistro(WebDriver driver, java.util.Map<String, String> datos) {
        Acciones.escribir(driver, By.cssSelector("input[name=full_name]"), datos.get("full_name"));
        Acciones.seleccionar(driver,
                Acciones.visible(driver, By.cssSelector("select[name=document_type]")), "CC");
        Acciones.escribir(driver, By.cssSelector("input[name=cedula]"), datos.get("cedula"));
        Acciones.escribir(driver, By.cssSelector("input[name=phone]"), datos.get("phone"));
        Acciones.escribir(driver, By.cssSelector("input[name=email]"), datos.get("email"));
        Acciones.escribir(driver, By.cssSelector("input[name=username]"), datos.get("username"));
        Acciones.escribir(driver, By.cssSelector("input[name=password]"), datos.get("password"));
        Acciones.escribir(driver, By.cssSelector("input[name=confirm_password]"), datos.get("confirm_password"));
        boolean aceptar = !"false".equals(datos.get("accept_terms"));
        WebElement casilla = Acciones.visible(driver, By.cssSelector("#accept_terms"));
        if (casilla.isSelected() != aceptar) {
            Acciones.clic(driver, casilla);
        }
    }

    public static String sede(WebDriver driver) {
        Object id = Evidencia.nota("sedePruebasId");
        if (id != null && !"null".equals(String.valueOf(id))) {
            return String.valueOf(id);
        }
        return Acciones.sedePorApi(driver);
    }

    public static String nombreDeSede() {
        Object nombre = Evidencia.nota("sedePruebas");
        return nombre == null ? "" : String.valueOf(nombre);
    }

    public static String turnoEnEspera(WebDriver cliente, String tipo) {
        Acciones.ir(cliente, "/home");
        Acciones.esperarInicioCliente(cliente);
        if (Acciones.existe(cliente, By.cssSelector(".btn-cancel-turn"))) {
            if (!turnoActivoEsVirtual(cliente)) {
                return Acciones.texto(cliente, By.cssSelector(".turn-hero-number"));
            }
            liberarTurnoDelCliente(cliente);
        }
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);
        return Acciones.pedirTurno(cliente, tipo, "presencial", sede(cliente));
    }

    public static String turnoVirtualEnEspera(WebDriver cliente) {
        Acciones.ir(cliente, "/home");
        Acciones.esperarInicioCliente(cliente);
        if (Acciones.existe(cliente, By.cssSelector(".virtual-docs-card"))) {
            return Acciones.texto(cliente, By.cssSelector(".turn-hero-number"));
        }
        if (Acciones.existe(cliente, By.cssSelector(".btn-cancel-turn"))) {
            liberarTurnoDelCliente(cliente);
        }
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);
        String numero = Acciones.pedirTurno(cliente, "general", "virtual", null);
        Acciones.visible(cliente, By.cssSelector(".virtual-docs-card"), Config.ESPERA_LARGA);
        return numero;
    }

    public static boolean turnoActivoEsVirtual(WebDriver cliente) {
        return Acciones.texto(cliente, By.cssSelector(".turn-hero-sede")).toLowerCase().contains("virtual")
                || Acciones.existe(cliente, By.cssSelector(".virtual-docs-card"));
    }

    public static void adjuntarDocumento(WebDriver cliente, int indice) {
        Evidencia.captura(cliente, "_documento_prueba");
        Path archivo = Config.EVIDENCIAS.resolve("_documento_prueba.png");
        List<WebElement> entradas = Acciones.todos(cliente, By.cssSelector(".doc-row input[type=file]"));
        if (indice >= entradas.size()) {
            return;
        }
        Acciones.subirArchivo(cliente, entradas.get(indice), archivo);
        Acciones.esperaJs(cliente,
                "/En revisi/.test((document.querySelector('.virtual-docs-card')||{}).innerText||'')",
                Config.ESPERA_LARGA);
        Acciones.esperar(3000);
    }

    public static void abrirChatbot(WebDriver cliente) {
        Acciones.ir(cliente, "/chatbot");
        Acciones.visible(cliente, By.cssSelector("textarea"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
    }

    public static int largoDeConversacion(WebDriver cliente) {
        Object largo = ((org.openqa.selenium.JavascriptExecutor) cliente)
                .executeScript("return document.body.innerText.length;");
        return ((Number) largo).intValue();
    }

    public static boolean esperarRespuesta(WebDriver cliente, int largoAntes) {
        boolean llego = Acciones.esperaJs(cliente,
                "document.body.innerText.length > " + (largoAntes + 40), 120);
        Acciones.esperar(2500);
        return llego;
    }

    public static void escribirEnChat(WebDriver cliente, String mensaje) {
        WebElement caja = Acciones.visible(cliente, By.cssSelector("textarea"), Config.ESPERA);
        caja.clear();
        caja.sendKeys(mensaje);
        caja.sendKeys(org.openqa.selenium.Keys.ENTER);
    }

    public static void abrirAccionesDelTurno(WebDriver empleado) {
        if (!Acciones.existe(empleado, By.cssSelector(".action-modal"))) {
            Acciones.clicTexto(empleado, "Acciones del Turno");
        }
        Acciones.visible(empleado, By.cssSelector(".action-modal"), Config.ESPERA);
        Acciones.esperar(600);
    }

    public static void accionDelTurno(WebDriver empleado, String accion) {
        abrirAccionesDelTurno(empleado);
        Acciones.clic(empleado, By.xpath(
                "//div[contains(@class,'action-modal')]//button[contains(.,'" + accion + "')]"));
        Acciones.esperaJs(empleado, "!document.querySelector('#currentTurn')", Config.ESPERA_LARGA);
        Acciones.esperar(2000);
    }

    public static String llamarSiguiente(WebDriver empleado) {
        Acciones.ir(empleado, "/employee");
        Acciones.esperar(4000);
        Acciones.clic(empleado, By.cssSelector("#callBtn"));
        Acciones.visible(empleado, By.cssSelector("#currentTurn"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        return Acciones.texto(empleado, By.cssSelector("#currentTurn"));
    }

    public static void atenderTurnoVirtual(WebDriver especialista, String turno) {
        Acciones.ir(especialista, "/virtual-turns");
        Acciones.visible(especialista, By.xpath("//tr[contains(., '" + turno + "')]"), Config.ESPERA_LARGA);
        if (Acciones.existe(especialista,
                By.xpath("//tr[contains(., '" + turno + "')]//button[contains(.,'Retomar')]"))) {
            Acciones.clic(especialista,
                    By.xpath("//tr[contains(., '" + turno + "')]//button[contains(.,'Retomar')]"));
        } else {
            Acciones.clic(especialista,
                    By.xpath("//tr[contains(., '" + turno + "')]//button[contains(.,'Atender')]"));
        }
        Acciones.visible(especialista, By.cssSelector(".chat-panel"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
    }

    public static void limpiarCola(WebDriver empleado) {
        Acciones.ir(empleado, "/employee");
        Acciones.esperar(4000);
        for (int i = 0; i < 12; i++) {
            if (Acciones.existe(empleado, By.cssSelector("#currentTurn"))) {
                accionDelTurno(empleado, "Completar");
                continue;
            }
            List<WebElement> pendientes = Acciones.todos(empleado, By.cssSelector(".turn-item"));
            if (pendientes.isEmpty()) {
                return;
            }
            Acciones.clic(empleado, pendientes.get(0).findElement(By.cssSelector(".call-turn-btn")));
            Acciones.visible(empleado, By.cssSelector("#currentTurn"), Config.ESPERA_LARGA);
            Acciones.esperar(1500);
            accionDelTurno(empleado, "Cancelar");
        }
    }

    public static void liberarTurnoDelCliente(WebDriver cliente) {
        System.out.println("[escenario] " + Acciones.limpiarTurnoActivoPorApi(cliente));
        Acciones.ir(cliente, "/home");
        Acciones.esperarInicioCliente(cliente);
    }
}
