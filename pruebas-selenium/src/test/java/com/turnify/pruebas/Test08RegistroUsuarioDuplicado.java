package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 08 - Registro duplicado: el sistema rechaza un nombre de usuario que ya existe (CP-08)")
class Test08RegistroUsuarioDuplicado {

    private WebDriver navegador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp08_registroDuplicado() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/register");
        String yaRegistrado = Cuentas.asegurarCliente(navegador);

        Map<String, String> datos = Escenario.datosNuevoCliente();
        datos.put("username", yaRegistrado);
        Escenario.diligenciarRegistro(navegador, datos);
        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));
        Acciones.esperar(6000);

        String alerta = Acciones.textoPlano(navegador, By.cssSelector("#error-container"));
        String boton = Acciones.texto(navegador, By.cssSelector("button[type=submit]"));
        Evidencia.nota("registroDuplicadoAlerta", alerta);
        Evidencia.nota("registroDuplicadoBoton", boton);
        Evidencia.captura(navegador, "cp06_registro_usuario_duplicado");

        Map<String, String> otros = Escenario.datosNuevoCliente();
        otros.put("username", yaRegistrado);
        String[] respuesta = Acciones.api(navegador, "POST", "/api/register/", String.format(
                "{\"username\":\"%s\",\"password\":\"%s\",\"confirm_password\":\"%s\",\"full_name\":\"%s\","
                        + "\"document_type\":\"CC\",\"cedula\":\"%s\",\"phone\":\"%s\",\"email\":\"%s\","
                        + "\"accept_terms\":true}",
                otros.get("username"), otros.get("password"), otros.get("confirm_password"),
                otros.get("full_name"), otros.get("cedula"), otros.get("phone"), otros.get("email")));
        Evidencia.nota("registroDuplicadoHttp", respuesta[0]);
        Evidencia.nota("registroDuplicadoCuerpo", respuesta[1]);

        assertEquals("409", respuesta[0], "El servidor debe rechazar el usuario duplicado con 409");
        assertTrue(respuesta[1].toLowerCase().contains("registrado"),
                "El servidor debe avisar que el nombre de usuario ya esta registrado");
        assertTrue(alerta.toLowerCase().contains("registrado"),
                "CP-08 FALLIDO: el servidor responde 'El nombre de usuario ya esta registrado' pero la pantalla"
                        + " no lo muestra (el boton quedo en '" + boton + "').");
    }
}
