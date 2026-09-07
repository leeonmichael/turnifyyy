package com.turnify.pruebas;

import org.openqa.selenium.Alert;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoAlertPresentException;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chromium.ChromiumDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Acciones {

    private Acciones() { }

    public static void esperar(long milisegundos) {
        try {
            Thread.sleep(milisegundos);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public static WebDriverWait espera(WebDriver driver, int segundos) {
        return new WebDriverWait(driver, Duration.ofSeconds(segundos));
    }

    public static WebElement visible(WebDriver driver, By selector) {
        return visible(driver, selector, Config.ESPERA);
    }

    public static WebElement visible(WebDriver driver, By selector, int segundos) {
        return espera(driver, segundos).until(ExpectedConditions.visibilityOfElementLocated(selector));
    }

    public static WebElement presente(WebDriver driver, By selector, int segundos) {
        return espera(driver, segundos).until(ExpectedConditions.presenceOfElementLocated(selector));
    }

    public static List<WebElement> todos(WebDriver driver, By selector) {
        return driver.findElements(selector);
    }

    public static boolean existe(WebDriver driver, By selector) {
        return !driver.findElements(selector).isEmpty();
    }

    public static boolean esperaJs(WebDriver driver, String condicion, int segundos) {
        try {
            espera(driver, segundos).until(d ->
                    Boolean.TRUE.equals(((JavascriptExecutor) d).executeScript("return !!(" + condicion + ");")));
            return true;
        } catch (TimeoutException e) {
            return false;
        }
    }

    public static boolean esperaEnCliente(WebDriver driver, String condicion) {
        if (esperaJs(driver, condicion, Config.ESPERA_TIEMPO_REAL)) {
            return true;
        }
        System.out.println("[cliente] sin actualizacion en tiempo real; se recarga la pagina");
        Evidencia.nota("recargasPorWebSocket",
                ((Number) (Evidencia.nota("recargasPorWebSocket") == null
                        ? 0 : ((Number) Evidencia.nota("recargasPorWebSocket")).intValue())).intValue() + 1);
        driver.navigate().refresh();
        esperar(2500);
        return esperaJs(driver, condicion, Config.ESPERA_LARGA);
    }

    public static void ir(WebDriver driver, String ruta) {
        driver.get(Config.BASE + ruta);
        esperar(700);
    }

    public static void clic(WebDriver driver, WebElement elemento) {
        ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", elemento);
        esperar(300);
    }

    public static void clic(WebDriver driver, By selector) {
        clic(driver, visible(driver, selector));
    }

    public static void clicTexto(WebDriver driver, String texto) {
        WebElement boton = visible(driver, By.xpath(
                "//button[contains(normalize-space(.),\"" + texto + "\")]"
                        + " | //a[contains(normalize-space(.),\"" + texto + "\")]"));
        clic(driver, boton);
    }

    public static void escribir(WebDriver driver, By selector, String valor) {
        WebElement campo = visible(driver, selector);
        campo.clear();
        campo.sendKeys(valor);
    }

    public static void seleccionar(WebDriver driver, WebElement select, String valor) {
        new Select(select).selectByValue(valor);
        esperar(400);
    }

    public static String texto(WebDriver driver, By selector) {
        try {
            return driver.findElement(selector).getText().trim();
        } catch (NoSuchElementException e) {
            return "";
        }
    }

    public static String textoPlano(WebDriver driver, By selector) {
        return texto(driver, selector).replaceAll("\\s+", " ").trim();
    }

    public static void desplazarA(WebDriver driver, By selector) {
        if (existe(driver, selector)) {
            ((JavascriptExecutor) driver).executeScript(
                    "arguments[0].scrollIntoView({block:'center'});", driver.findElement(selector));
            esperar(500);
        }
    }

    public static WebElement fila(WebDriver driver, String texto) {
        return visible(driver, By.xpath("//tr[contains(., \"" + texto + "\")]"), Config.ESPERA);
    }

    public static boolean hayFila(WebDriver driver, String texto) {
        return existe(driver, By.xpath("//tr[contains(., \"" + texto + "\")]"));
    }

    public static void fijarFecha(WebDriver driver, WebElement campo, String fechaIso) {
        ((JavascriptExecutor) driver).executeScript(
                "arguments[0].value = arguments[1];"
                        + "arguments[0].dispatchEvent(new Event('input', {bubbles:true}));"
                        + "arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
                campo, fechaIso);
        esperar(400);
    }

    public static void subirArchivo(WebDriver driver, WebElement input, Path archivo) {
        ((JavascriptExecutor) driver).executeScript(
                "arguments[0].removeAttribute('hidden');"
                        + "arguments[0].style.display='block';"
                        + "arguments[0].style.visibility='visible';"
                        + "arguments[0].style.height='1px';arguments[0].style.width='1px';", input);
        input.sendKeys(archivo.toAbsolutePath().toString());
        esperar(800);
    }

    public static String aceptarAlerta(WebDriver driver) {
        try {
            Alert alerta = espera(driver, 8).until(ExpectedConditions.alertIsPresent());
            String mensaje = alerta.getText();
            alerta.accept();
            System.out.println("[alerta] " + mensaje);
            esperar(400);
            return mensaje;
        } catch (TimeoutException | NoAlertPresentException e) {
            return "";
        }
    }

    public static String responderPrompt(WebDriver driver, String respuesta) {
        try {
            Alert alerta = espera(driver, 8).until(ExpectedConditions.alertIsPresent());
            String mensaje = alerta.getText();
            alerta.sendKeys(respuesta);
            alerta.accept();
            System.out.println("[prompt] " + mensaje);
            esperar(400);
            return mensaje;
        } catch (TimeoutException | NoAlertPresentException e) {
            return "";
        }
    }

    public static String[] api(WebDriver driver, String metodo, String ruta, String cuerpoJson) {
        String script =
                "const cb = arguments[arguments.length - 1];"
                        + "const t = localStorage.getItem('turnify_token');"
                        + "const h = {'Content-Type':'application/json'};"
                        + "if (t) { h['Authorization'] = 'Bearer ' + t; }"
                        + "fetch(arguments[0], {method: arguments[1], headers: h, body: arguments[2]})"
                        + "  .then(async r => cb(r.status + '||' + (await r.text()).slice(0, 500)))"
                        + "  .catch(e => cb('0||' + e));";
        Object salida = ((JavascriptExecutor) driver).executeAsyncScript(script, ruta, metodo, cuerpoJson);
        String[] partes = String.valueOf(salida).split("\\|\\|", 2);
        return new String[]{partes[0], partes.length > 1 ? partes[1] : ""};
    }

    public static void esperarInicioCliente(WebDriver driver) {
        for (int intento = 1; intento <= 3; intento++) {
            if (esperaJs(driver,
                    "document.querySelector('.request-card') || document.querySelector('.turn-hero')", 40)) {
                esperar(1200);
                return;
            }
            System.out.println("[cliente] Inicio sin dibujar (intento " + intento + "); se recarga la pagina");
            Evidencia.nota("recargasInicioCliente",
                    (Evidencia.nota("recargasInicioCliente") == null
                            ? 0 : ((Number) Evidencia.nota("recargasInicioCliente")).intValue()) + 1);
            driver.navigate().refresh();
            esperar(3000);
        }
        espera(driver, Config.ESPERA_LARGA).until(d ->
                existe(d, By.cssSelector(".request-card")) || existe(d, By.cssSelector(".turn-hero")));
        esperar(1200);
    }

    public static String sedePorApi(WebDriver driver) {
        String[] r = api(driver, "GET", "/api/sedes/", null);
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"id\"\\s*:\\s*\"([^\"]+)\"[^}]*?\"name\"\\s*:\\s*\"([^\"]+)\"").matcher(r[1]);
        String id = null;
        String nombre = null;
        while (m.find()) {
            id = m.group(1);
            nombre = m.group(2);
        }
        if (id != null) {
            Evidencia.nota("sedePruebasId", id);
            Evidencia.nota("sedePruebas", nombre);
        }
        return id;
    }

    public static void permitirDescargas(WebDriver driver) {
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("behavior", "allow");
        parametros.put("downloadPath", Config.DESCARGAS.toString());
        try {
            ((ChromiumDriver) driver).executeCdpCommand("Page.setDownloadBehavior", parametros);
        } catch (RuntimeException e) {
            System.out.println("[descargas] no se pudo configurar la carpeta: " + e.getMessage());
        }
    }

    public static void sinConexion(WebDriver driver, boolean activar) {
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("offline", activar);
        parametros.put("latency", 0);
        parametros.put("downloadThroughput", activar ? 0 : -1);
        parametros.put("uploadThroughput", activar ? 0 : -1);
        ((ChromiumDriver) driver).executeCdpCommand("Network.enable", new HashMap<>());
        ((ChromiumDriver) driver).executeCdpCommand("Network.emulateNetworkConditions", parametros);
        esperar(600);
    }

    public static void iniciarSesion(WebDriver driver, String usuario, String clave) {
        ir(driver, "/login");
        visible(driver, By.cssSelector("input[name=username]"), Config.ESPERA);
        escribir(driver, By.cssSelector("input[name=username]"), usuario);
        escribir(driver, By.cssSelector("input[name=password]"), clave);
        clic(driver, By.cssSelector("button[type=submit]"));
        boolean entro = esperaJs(driver, "!location.pathname.endsWith('/login')", Config.ESPERA_LARGA);
        if (!entro) {
            String error = texto(driver, By.cssSelector(".alert-error"));
            throw new IllegalStateException("No se pudo iniciar sesion con " + usuario
                    + (error.isEmpty() ? "" : " - mensaje en pantalla: " + error));
        }
        esperar(2500);
    }

    public static void cerrarSesion(WebDriver driver) {
        if (existe(driver, By.cssSelector(".navbar-logout-btn"))) {
            clic(driver, By.cssSelector(".navbar-logout-btn"));
            esperaJs(driver, "location.pathname.endsWith('/login')", Config.ESPERA);
            esperar(1200);
        }
    }

    public static String pedirTurno(WebDriver driver, String tipo, String modalidad, String sedeId) {
        ir(driver, "/home");
        esperarInicioCliente(driver);
        cancelarTurnoActivoSiHay(driver);
        visible(driver, By.cssSelector(".request-card"), Config.ESPERA_LARGA);

        List<WebElement> selects = todos(driver, By.cssSelector(".request-card select"));
        seleccionar(driver, selects.get(0), tipo);
        seleccionar(driver, todos(driver, By.cssSelector(".request-card select")).get(1), modalidad);
        if ("presencial".equals(modalidad) && sedeId != null) {
            esperaJs(driver,
                    "document.querySelectorAll('.request-card select').length >= 3"
                            + " && document.querySelectorAll('.request-card select')[2].options.length > 0",
                    Config.ESPERA_LARGA);
            esperar(600);
            seleccionar(driver, todos(driver, By.cssSelector(".request-card select")).get(2), sedeId);
        }
        esperar(600);

        clic(driver, By.cssSelector(".get-turn-btn"));
        visible(driver, By.xpath("//*[contains(@class,'modal-title') and contains(.,'Turno Asignado')]"),
                Config.ESPERA_LARGA);
        clicTexto(driver, "Entendido");
        visible(driver, By.cssSelector(".turn-hero-number"), Config.ESPERA);
        esperar(2000);
        return texto(driver, By.cssSelector(".turn-hero-number"));
    }

    public static void cancelarTurnoActivoSiHay(WebDriver driver) {
        if (!existe(driver, By.cssSelector(".turn-hero"))) {
            return;
        }
        if (existe(driver, By.cssSelector(".action-row .get-turn-btn"))) {
            clic(driver, todos(driver, By.cssSelector(".action-row .get-turn-btn")).get(0));
        } else if (existe(driver, By.cssSelector(".btn-cancel-turn"))) {
            clic(driver, By.cssSelector(".btn-cancel-turn"));
        }
        visible(driver, By.cssSelector(".request-card"), Config.ESPERA_LARGA);
        esperar(1200);
    }

    public static String limpiarTurnoActivoPorApi(WebDriver driver) {
        String[] activo = api(driver, "GET", "/api/my-active-turn/", null);
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"number\"\\s*:\\s*\"([^\"]+)\"").matcher(activo[1]);
        if (!m.find()) {
            return "sin turno activo";
        }
        String numero = m.group(1);
        String[] r = api(driver, "DELETE", "/api/cancel-turn/" + numero + "/", null);
        return "cancelado " + numero + " (HTTP " + r[0] + ")";
    }

    public static String fechaEnDias(int dias) {
        return java.time.LocalDate.now().plusDays(dias).toString();
    }
}
