package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertFalse;

@DisplayName("Test 11 - Rutas protegidas por rol: cada perfil solo entra a sus pantallas y es redirigido si intenta otras (CP-11)")
class Test11RutasProtegidasPorRol {

    private WebDriver cliente;
    private WebDriver empleado;
    private WebDriver administrador;
    private WebDriver especialista;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(especialista);
        Navegador.cerrar(administrador);
        Navegador.cerrar(empleado);
        Navegador.cerrar(cliente);
    }

    @Test
    void cp11_rutasProtegidasPorRol() {
        cliente = Escenario.cliente();
        String clienteEnDashboard = irA(cliente, "/dashboard", "cp09_cliente_bloqueado_dashboard");
        String clienteEnPanel = irA(cliente, "/employee", null);
        Evidencia.nota("clienteEnDashboard", clienteEnDashboard);
        Evidencia.nota("clienteEnPanelEmpleado", clienteEnPanel);

        administrador = Escenario.administrador();
        String adminEnPanel = irA(administrador, "/employee", "ad11_admin_ruta_empleado");
        Evidencia.nota("adminEnPanelEmpleado", adminEnPanel);

        empleado = Escenario.empleado();
        String empleadoEnDashboard = irA(empleado, "/dashboard", "em10_empleado_ruta_dashboard");
        Evidencia.nota("empleadoEnDashboard", empleadoEnDashboard);

        especialista = Escenario.especialistaVirtual();
        String especialistaEnPanel = irA(especialista, "/employee", "vi02_virtual_redirigido");
        Evidencia.nota("especialistaEnPanelPresencial", especialistaEnPanel);

        assertFalse(clienteEnDashboard.contains("/dashboard"), "El cliente no debe ver el Dashboard");
        assertFalse(clienteEnPanel.contains("/employee"), "El cliente no debe ver el Panel de empleado");
        assertFalse(adminEnPanel.contains("/employee"), "El administrador no debe ver el Panel de empleado");
        assertFalse(empleadoEnDashboard.contains("/dashboard"), "El empleado no debe ver el Dashboard");
        assertFalse(especialistaEnPanel.contains("/employee"),
                "El especialista en turnos virtuales no debe ver el Panel presencial");
    }

    private String irA(WebDriver driver, String ruta, String captura) {
        Acciones.ir(driver, ruta);
        Acciones.esperar(3500);
        if (captura != null) {
            Evidencia.captura(driver, captura);
        }
        return driver.getCurrentUrl();
    }
}
