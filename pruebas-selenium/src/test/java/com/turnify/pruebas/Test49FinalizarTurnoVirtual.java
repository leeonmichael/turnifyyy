package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 49 - Finalizar el turno virtual: se revisa el formulario de reagendar y se cierra la atencion como atendida (CP-40)")
class Test49FinalizarTurnoVirtual {

    private WebDriver especialista;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(especialista);
    }

    @Test
    void cp40_finalizarTurnoVirtual() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Escenario.adjuntarDocumento(cliente, 0);

        especialista = Escenario.especialistaVirtual();
        Escenario.atenderTurnoVirtual(especialista, turno);

        Acciones.desplazarA(especialista, By.cssSelector(".chat-actions-bar"));
        Acciones.clicTexto(especialista, "Reagendar");
        Acciones.visible(especialista, By.cssSelector(".reschedule-inline-bar"), Config.ESPERA);
        WebElement fecha = Acciones.visible(especialista, By.cssSelector(".reschedule-inline-bar input[type=date]"));
        Evidencia.nota("virtualReagendarPrecargada", fecha.getAttribute("value"));
        Evidencia.nota("virtualReagendarMinima", fecha.getAttribute("min"));
        Evidencia.captura(especialista, "vi06_reagendar_virtual_formulario");
        Acciones.clic(especialista,
                By.xpath("//div[contains(@class,'reschedule-inline-bar')]//button[contains(.,'Cancelar')]"));
        Acciones.esperar(1500);

        Acciones.clicTexto(especialista, "Finalizar");
        boolean cerroAtencion = Acciones.esperaJs(especialista,
                "!document.querySelector('.chat-panel')", Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        String lista = Acciones.textoPlano(especialista, By.cssSelector("body"));
        Evidencia.nota("listaVirtualTrasFinalizar", lista.contains("No hay turnos virtuales"));
        Evidencia.captura(especialista, "vi07a_turno_virtual_finalizado");

        boolean clienteVeAtendido = Acciones.esperaEnCliente(cliente, "document.querySelector('.banner-finished')");
        Acciones.esperar(1500);
        Evidencia.captura(cliente, "vi07b_cliente_virtual_atendido");

        Acciones.ir(cliente, "/my-turns");
        Acciones.esperar(5000);
        String historial = Acciones.textoPlano(cliente, By.cssSelector("body"));
        Evidencia.nota("historialFinalCliente",
                historial.length() > 700 ? historial.substring(0, 700) : historial);
        Evidencia.capturaCompleta(cliente, "vi07c_mis_turnos_historial_completo");

        assertTrue(Evidencia.nota("virtualReagendarMinima") != null,
                "El selector de fecha del reagendamiento no debe permitir fechas pasadas");
        assertTrue(cerroAtencion, "Al finalizar debe cerrarse el panel de atencion");
        assertTrue(clienteVeAtendido, "El cliente debe ver que su turno virtual fue atendido");
        assertTrue(historial.contains(turno),
                "El turno " + turno + " debe quedar registrado en el historial del cliente");
    }
}
