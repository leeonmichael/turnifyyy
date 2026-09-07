package com.turnify.pruebas;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public final class Cuentas {

    private Cuentas() { }

    public static String sufijo() {
        String s = String.valueOf(System.currentTimeMillis());
        return s.substring(s.length() - 6);
    }

    public static String clienteUsuario() {
        Object v = Evidencia.nota("clienteUsuario");
        return v == null ? null : String.valueOf(v);
    }

    public static String clienteCorreo() {
        Object v = Evidencia.nota("clienteCorreo");
        return v == null ? null : String.valueOf(v);
    }

    public static String asegurarCliente(WebDriver driver) {
        String usuario = clienteUsuario();
        if (usuario != null) {
            return usuario;
        }
        String s = sufijo();
        usuario = "qa_cli" + s;
        registrarPorApi(driver, usuario, "Cliente QA Web", "10" + s + "0011",
                "31" + s + "0022", usuario + "@correo.com");
        Evidencia.nota("clienteUsuario", usuario);
        Evidencia.nota("clienteCorreo", usuario + "@correo.com");
        Evidencia.nota("clienteCedula", "10" + s + "0011");
        Evidencia.nota("clienteTelefono", "31" + s + "0022");
        return usuario;
    }

    public static String asegurarSegundoCliente(WebDriver driver) {
        Object v = Evidencia.nota("cliente2Usuario");
        if (v != null) {
            return String.valueOf(v);
        }
        String s = sufijo();
        String usuario = "qa_cli2_" + s;
        registrarPorApi(driver, usuario, "Cliente Dos QA", "30" + s + "0011",
                "32" + s + "0022", usuario + "@correo.com");
        Evidencia.nota("cliente2Usuario", usuario);
        return usuario;
    }

    public static String empleadoPresencial() {
        Object v = Evidencia.nota("empleadoPresencial");
        return v == null ? Config.EMP_PRESENCIAL : String.valueOf(v);
    }

    public static String empleadoVirtual() {
        Object v = Evidencia.nota("empleadoVirtual");
        return v == null ? Config.EMP_VIRTUAL : String.valueOf(v);
    }

    public static String registrarPorApi(WebDriver driver, String usuario, String nombre,
                                         String cedula, String telefono, String correo) {
        String cuerpo = String.format(
                "{\"username\":\"%s\",\"password\":\"%s\",\"confirm_password\":\"%s\","
                        + "\"full_name\":\"%s\",\"document_type\":\"CC\",\"cedula\":\"%s\","
                        + "\"phone\":\"%s\",\"email\":\"%s\",\"accept_terms\":true}",
                usuario, Config.CLIENTE_CLAVE, Config.CLIENTE_CLAVE, nombre, cedula, telefono, correo);
        String[] r = Acciones.api(driver, "POST", "/api/register/", cuerpo);
        System.out.println("[cuentas] registro " + usuario + " -> HTTP " + r[0]);
        return r[0];
    }

    public static void asegurarEmpleados(WebDriver admin, String sedeId) {
        Acciones.ir(admin, "/dashboard");
        Acciones.visible(admin, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        activarSiEstaInactivo(admin, Config.EMP_PRESENCIAL);
        activarSiEstaInactivo(admin, Config.EMP_VIRTUAL);
        if (!Acciones.hayFila(admin, Config.EMP_PRESENCIAL)) {
            crearEmpleado(admin, Config.EMP_PRESENCIAL, "Empleado QA Presencial", sedeId);
        }
        if (!Acciones.hayFila(admin, Config.EMP_VIRTUAL)) {
            crearEmpleado(admin, Config.EMP_VIRTUAL, "Empleado QA Virtual", "VIRTUAL");
        }
    }

    public static void crearEmpleado(WebDriver admin, String usuario, String nombre, String sedeValor) {
        String s = sufijo();
        Acciones.desplazarA(admin, By.cssSelector(".employee-form"));
        Acciones.escribir(admin, By.cssSelector("input[name=empUsername]"), usuario);
        Acciones.escribir(admin, By.cssSelector("input[name=empPassword]"), Config.EMP_CLAVE);
        Acciones.escribir(admin, By.cssSelector("input[name=empFullName]"), nombre);
        Acciones.seleccionar(admin, Acciones.visible(admin, By.cssSelector("select[name=empDocumentType]")), "CC");
        Acciones.escribir(admin, By.cssSelector("input[name=empCedula]"), "20" + s + "11");
        Acciones.escribir(admin, By.cssSelector("input[name=empEmail]"), usuario + "@correo.com");
        Acciones.escribir(admin, By.cssSelector("input[name=empPhone]"), "31" + s + "44");
        Acciones.esperaJs(admin,
                "document.querySelector('select[name=empSede]').options.length > 1", Config.ESPERA_LARGA);
        Acciones.seleccionar(admin, Acciones.visible(admin, By.cssSelector("select[name=empSede]")), sedeValor);
        Acciones.clicTexto(admin, "Crear Empleado");
        Acciones.aceptarAlerta(admin);
        Acciones.esperaJs(admin, "document.body.innerText.includes('" + usuario + "')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
    }

    public static void activarSiEstaInactivo(WebDriver admin, String usuario) {
        if (!Acciones.hayFila(admin, usuario)) {
            return;
        }
        if (Acciones.existe(admin, By.xpath("//tr[contains(., \"" + usuario + "\")]//button[normalize-space()='Activar']"))) {
            Acciones.clic(admin, By.xpath("//tr[contains(., \"" + usuario + "\")]//button[normalize-space()='Activar']"));
            Acciones.esperar(3500);
            System.out.println("[cuentas] " + usuario + " reactivado");
        }
    }

    public static void desactivar(WebDriver admin, String usuario) {
        if (!Acciones.hayFila(admin, usuario)) {
            return;
        }
        By boton = By.xpath("//tr[contains(., \"" + usuario + "\")]//button[normalize-space()='Desactivar']");
        if (Acciones.existe(admin, boton)) {
            Acciones.clic(admin, boton);
            Acciones.esperar(3500);
            System.out.println("[cuentas] " + usuario + " desactivado");
        }
    }
}
