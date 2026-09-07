package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 45 - Acceso del especialista virtual: entra directo a Turnos Virtuales y ve los turnos con sus documentos (CP-36)")
class Test45AccesoDelEspecialistaVirtual {

    private WebDriver especialista;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(especialista);
    }

    @Test
    void cp36_accesoDelEspecialista() {
        cliente = Escenario.cliente();
        Escenario.liberarTurnoDelCliente(cliente);
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Evidencia.nota("turnoVirtualAtendido", turno);

        especialista = Escenario.especialistaVirtual();
        boolean enTurnosVirtuales = Acciones.esperaJs(especialista,
                "location.pathname.includes('/virtual-turns')", Config.ESPERA_LARGA);
        Acciones.esperaJs(especialista,
                "document.body.innerText.includes('" + turno + "')", Config.ESPERA_LARGA);
        Acciones.esperar(2000);

        String encabezado = Acciones.texto(especialista, By.cssSelector(".welcome-sede"));
        String fila = Acciones.fila(especialista, turno).getText().replaceAll("\\s+", " ");
        Evidencia.nota("especialistaEncabezado", encabezado);
        Evidencia.nota("especialistaFilaTurno", fila);
        Evidencia.captura(especialista, "vi01_login_especialista_virtual_lista");
        Evidencia.capturaElemento(Acciones.visible(especialista, By.cssSelector(".navbar")), "vi01b_navbar_virtual");

        assertTrue(enTurnosVirtuales, "El especialista debe entrar directo a la pantalla de Turnos Virtuales");
        assertTrue(encabezado.toLowerCase().contains("virtual"),
                "El encabezado debe identificarlo como especialista en turnos virtuales, mostro: " + encabezado);
        assertTrue(fila.contains(turno), "La lista debe incluir el turno virtual en espera " + turno);
    }
}
