package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 43 - Usuarios desde el rol empleado: solo puede ver y gestionar cuentas de clientes (CP-34)")
class Test43UsuariosDesdeElRolEmpleado {

    private WebDriver empleado;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(empleado);
    }

    @Test
    void cp34_usuariosDelEmpleado() {
        empleado = Escenario.empleado();
        Acciones.ir(empleado, "/manage-users");
        Acciones.visible(empleado, By.cssSelector("table tr"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);

        List<String> roles = new ArrayList<>();
        Acciones.todos(empleado, By.cssSelector("tbody tr td:nth-child(3)")).forEach(celda -> {
            String rol = celda.getText().trim();
            if (!roles.contains(rol)) {
                roles.add(rol);
            }
        });
        Evidencia.nota("empleadoRolesVisibles", roles);
        Evidencia.captura(empleado, "em09_usuarios_vista_empleado");

        assertTrue(roles.size() == 1 && roles.contains("client"),
                "El empleado solo debe ver usuarios de tipo cliente, vio: " + roles);
    }
}
