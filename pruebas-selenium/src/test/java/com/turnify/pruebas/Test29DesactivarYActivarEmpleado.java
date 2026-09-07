package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 29 - Desactivar y activar un empleado: la cuenta queda inactiva y luego vuelve a quedar activa (CP-45)")
class Test29DesactivarYActivarEmpleado {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp45_desactivarYActivar() {
        Escenario.prepararEmpleados();
        String empleado = Cuentas.empleadoVirtual();
        administrador = Escenario.administrador();
        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);

        Acciones.clic(administrador,
                By.xpath("//tr[contains(., \"" + empleado + "\")]//button[normalize-space()='Desactivar']"));
        Acciones.esperar(5000);
        administrador.navigate().refresh();
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        String filaInactiva = Acciones.fila(administrador, empleado).getText().replaceAll("\\s+", " ");
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + empleado + "\")]"));
        Evidencia.captura(administrador, "ad05a_empleado_desactivado");

        Acciones.clic(administrador,
                By.xpath("//tr[contains(., \"" + empleado + "\")]//button[normalize-space()='Activar']"));
        Acciones.esperar(5000);
        administrador.navigate().refresh();
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        String filaActiva = Acciones.fila(administrador, empleado).getText().replaceAll("\\s+", " ");
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + empleado + "\")]"));
        Evidencia.captura(administrador, "ad05b_empleado_reactivado");

        Evidencia.nota("empleadoFilaInactivo", filaInactiva);
        Evidencia.nota("empleadoFilaActivo", filaActiva);

        assertTrue(filaInactiva.contains("Inactivo"),
                "Al desactivar, el empleado debe quedar Inactivo, la fila muestra: " + filaInactiva);
        assertTrue(!filaActiva.contains("Inactivo"),
                "Al activarlo de nuevo debe quedar Activo, la fila muestra: " + filaActiva);
    }
}
