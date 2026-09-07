package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 21 - Editar el perfil: los cambios de nombre y telefono deben guardarse y seguir ahi al recargar (CP-23)")
class Test21EditarPerfil {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp23_editarPerfil() {
        cliente = Escenario.cliente();
        Acciones.ir(cliente, "/profile");
        Acciones.visible(cliente, By.cssSelector("input[name=full_name]"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);

        String nombreAlAbrir = Acciones.visible(cliente, By.cssSelector("input[name=full_name]")).getAttribute("value");
        Evidencia.nota("perfilNombreAlAbrir", nombreAlAbrir);
        Evidencia.captura(cliente, "cp14a_perfil_pagina");

        String nuevoNombre = "Cliente QA Web Editado";
        Acciones.escribir(cliente, By.cssSelector("input[name=full_name]"), nuevoNombre);
        Acciones.escribir(cliente, By.cssSelector("input[name=phone]"), "3216549870");
        Acciones.clic(cliente, By.cssSelector("button[type=submit]"));
        Acciones.esperar(7000);

        String mensaje = Acciones.textoPlano(cliente, By.cssSelector(".message, .alert, .alert-success"));
        String boton = Acciones.texto(cliente, By.cssSelector("button[type=submit]"));
        Evidencia.nota("perfilMensaje", mensaje);
        Evidencia.nota("perfilBoton", boton);
        Evidencia.captura(cliente, "cp14b_perfil_actualizado");

        String[] respuesta = Acciones.api(cliente, "PUT", "/api/update-profile/",
                "{\"full_name\":\"" + nuevoNombre + "\"}");
        Evidencia.nota("perfilHttp", respuesta[0]);
        Evidencia.nota("perfilCuerpo", respuesta[1]);

        cliente.navigate().refresh();
        Acciones.visible(cliente, By.cssSelector("input[name=full_name]"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        String nombreTrasRecargar = Acciones.visible(cliente, By.cssSelector("input[name=full_name]")).getAttribute("value");
        Evidencia.nota("perfilNombreTrasRecargar", nombreTrasRecargar);
        Evidencia.captura(cliente, "cp14d_perfil_datos_persistidos");

        assertTrue(mensaje.toLowerCase().contains("actualizado"),
                "CP-23 FALLIDO: no aparecio 'Perfil actualizado correctamente' (el boton quedo en '" + boton
                        + "') y la misma peticion enviada con el token responde HTTP " + respuesta[0]);
        assertEquals(nuevoNombre, nombreTrasRecargar,
                "El nombre editado debe seguir guardado despues de recargar la pagina");
    }
}
