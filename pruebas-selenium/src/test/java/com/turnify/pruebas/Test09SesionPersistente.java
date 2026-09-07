package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 09 - Sesion persistente: al recargar la pagina la sesion sigue abierta y no vuelve a pedir credenciales (CP-09)")
class Test09SesionPersistente {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp09_sesionPersistente() {
        cliente = Escenario.cliente();
        Acciones.ir(cliente, "/home");
        Acciones.esperarInicioCliente(cliente);

        cliente.navigate().refresh();
        Acciones.esperarInicioCliente(cliente);
        Acciones.esperar(1500);

        String url = cliente.getCurrentUrl();
        Evidencia.nota("urlTrasRecargar", url);
        Evidencia.captura(cliente, "cp08_sesion_persistente_recarga");

        assertTrue(url.contains("/home"),
                "Tras recargar debe seguir en Inicio, pero la direccion final fue: " + url);
    }
}
