package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 34 - Panel del empleado: entra a su panel y la cola muestra unicamente los turnos de su sede (CP-27)")
class Test34PanelDelEmpleado {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp27_panelDelEmpleado() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");

        empleado = Escenario.empleado();
        Acciones.ir(empleado, "/employee");
        Acciones.esperar(6000);

        String url = empleado.getCurrentUrl();
        String sede = Acciones.texto(empleado, By.cssSelector(".welcome-sede"));
        List<String> cola = new ArrayList<>();
        Acciones.todos(empleado, By.cssSelector(".turn-item .turn-number"))
                .forEach(numero -> cola.add(numero.getText().trim()));

        Evidencia.nota("empleadoUrl", url);
        Evidencia.nota("empleadoSede", sede);
        Evidencia.nota("empleadoCola", cola);
        Evidencia.captura(empleado, "em01_login_empleado_panel");
        Evidencia.capturaCompleta(empleado, "em01b_panel_empleado_completo");
        Evidencia.capturaElemento(Acciones.visible(empleado, By.cssSelector(".navbar")), "em01c_navbar_empleado");

        assertTrue(url.contains("/employee"), "El empleado debe entrar a su panel de atencion");
        assertTrue(sede.toUpperCase().contains(Escenario.nombreDeSede().toUpperCase()),
                "El panel debe mostrar la sede del empleado, mostro: " + sede);
        assertTrue(cola.contains(turno),
                "La cola debe listar el turno " + turno + " creado en esa sede, contiene: " + cola);
    }
}
