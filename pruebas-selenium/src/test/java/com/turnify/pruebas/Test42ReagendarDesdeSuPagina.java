package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 42 - Pagina Reagendar: lista los turnos activos y permite reagendarlos o marcarlos como no llego (CP-33)")
class Test42ReagendarDesdeSuPagina {

    private WebDriver empleado;
    private WebDriver primerCliente;
    private WebDriver segundoCliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(segundoCliente);
        Navegador.cerrar(primerCliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp33_paginaReagendar() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        primerCliente = Escenario.cliente();
        String turnoA = Escenario.turnoEnEspera(primerCliente, "general");
        segundoCliente = Escenario.segundoCliente();
        String turnoB = Escenario.turnoEnEspera(segundoCliente, "general");
        Evidencia.nota("reagendarTurnoA", turnoA);
        Evidencia.nota("reagendarTurnoB", turnoB);

        Acciones.ir(empleado, "/reschedule-turns");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + turnoB + "')", Config.ESPERA_LARGA);
        Acciones.esperar(2000);
        Evidencia.captura(empleado, "em08a_reagendar_turnos_lista");

        Acciones.clic(empleado, By.xpath("//tr[contains(., '" + turnoA + "')]//button[contains(.,'Reagendar')]"));
        Acciones.esperar(1200);
        WebElement fecha = Acciones.visible(empleado,
                By.xpath("//tr[contains(., '" + turnoA + "')]//input[@type='date']"), Config.ESPERA);
        String precargada = fecha.getAttribute("value");
        String minima = fecha.getAttribute("min");
        Acciones.fijarFecha(empleado, fecha, Acciones.fechaEnDias(4));
        Evidencia.nota("reagendarPaginaFechaPrecargada", precargada);
        Evidencia.nota("reagendarPaginaFechaMinima", minima);
        Evidencia.captura(empleado, "em08b_reagendar_fecha_inline");

        Acciones.clic(empleado, By.xpath("//tr[contains(., '" + turnoA + "')]//button[contains(.,'Confirmar')]"));
        boolean salioA = Acciones.esperaJs(empleado,
                "!document.body.innerText.includes('" + turnoA + "')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Evidencia.captura(empleado, "em08c_turno_reagendado_desaparece");

        Acciones.clic(empleado, By.xpath("//tr[contains(., '" + turnoB + "')]//button[contains(.,'No lleg')]"));
        boolean salioB = Acciones.esperaJs(empleado,
                "!document.body.innerText.includes('" + turnoB + "')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        String listaFinal = Acciones.textoPlano(empleado, By.cssSelector("body"));
        Evidencia.nota("reagendarListaFinal", listaFinal.contains("No hay turnos activos"));
        Evidencia.captura(empleado, "em08d_no_llego_lista_vacia");

        assertTrue(minima != null && !minima.isBlank(),
                "El selector de fecha debe impedir fechas anteriores a hoy");
        assertTrue(salioA, "El turno reagendado debe salir de la lista de turnos activos");
        assertTrue(salioB, "El turno marcado como 'No llego' debe salir de la lista");
    }
}
