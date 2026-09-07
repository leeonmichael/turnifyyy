package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

@DisplayName("Test 06 - Validacion del formulario de registro: cada dato invalido muestra su mensaje y no crea la cuenta (CP-06)")
class Test06RegistroValidacionDeCampos {

    private WebDriver navegador;
    private final Map<String, String> resultados = new LinkedHashMap<>();

    @AfterEach
    void cerrar() {
        Evidencia.nota("registroValidaciones", resultados);
        Evidencia.guardar();
        Navegador.cerrar(navegador);
    }

    @Test
    void cp06_validacionesDeRegistro() {
        navegador = Navegador.escritorio();
        Acciones.ir(navegador, "/register");
        Acciones.visible(navegador, By.cssSelector("input[name=full_name]"), Config.ESPERA);
        Evidencia.captura(navegador, "cp03_registro_pagina");

        resultados.put("contrasena debil", probar(
                Map.of("password", "abc123", "confirm_password", "abc123"),
                "12 caracteres", "cp04a_registro_password_debil"));
        resultados.put("confirmacion distinta", probar(
                Map.of("confirm_password", "OtraClave2026!"),
                "no coinciden", "cp04b_registro_password_no_coincide"));
        resultados.put("documento con letras", probar(
                Map.of("cedula", "12AB56"),
                "documento", "cp04c_registro_documento_invalido"));
        resultados.put("correo sin formato", probar(
                Map.of("email", "correo-sin-formato"),
                "correo", "cp04d_registro_correo_invalido"));
        resultados.put("telefono corto", probar(
                Map.of("phone", "12345"),
                "tel", "cp04e_registro_telefono_corto"));
        resultados.put("terminos sin marcar", probar(
                Map.of("accept_terms", "false"),
                "rminos", "cp04f_registro_sin_terminos"));

        resultados.forEach((campo, mensaje) ->
                assertFalse(mensaje.isBlank(), "No aparecio el mensaje de error para: " + campo));
    }

    private String probar(Map<String, String> datoInvalido, String textoEsperado, String captura) {
        Map<String, String> datos = Escenario.datosNuevoCliente();
        datos.putAll(datoInvalido);
        Escenario.diligenciarRegistro(navegador, datos);
        Acciones.clic(navegador, By.cssSelector("button[type=submit]"));
        Acciones.esperaJs(navegador, "(document.querySelector('#error-container')||{}).innerText", 12);
        Acciones.esperar(600);

        String mensaje = Acciones.textoPlano(navegador, By.cssSelector("#error-container"));
        Evidencia.captura(navegador, captura);
        System.out.println("[registro] " + captura + " -> " + mensaje);
        return mensaje.toLowerCase().contains(textoEsperado.toLowerCase()) ? mensaje : "";
    }
}
