package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 32 - Gestion de usuarios: al desactivar un cliente este no puede iniciar sesion y la tabla debe reflejarlo (CP-48)")
class Test32GestionDeUsuarios {

    private WebDriver administrador;
    private WebDriver clienteDesactivado;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(clienteDesactivado);
        Navegador.cerrar(administrador);
    }

    @Test
    void cp48_gestionDeUsuarios() {
        administrador = Escenario.administrador();
        String cliente = String.valueOf(Cuentas.asegurarSegundoCliente(administrador));

        Acciones.ir(administrador, "/manage-users");
        Acciones.visible(administrador, By.cssSelector("table tr"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);

        List<String> roles = new ArrayList<>();
        Acciones.todos(administrador, By.cssSelector("tbody tr td:nth-child(3)")).forEach(celda -> {
            String rol = celda.getText().trim();
            if (!roles.contains(rol)) {
                roles.add(rol);
            }
        });
        Evidencia.nota("usuariosRolesVisibles", roles);
        Evidencia.captura(administrador, "ad08a_gestion_usuarios_admin");

        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + cliente + "\")]"));
        Acciones.clic(administrador,
                By.xpath("//tr[contains(., \"" + cliente + "\")]//button[normalize-space()='Desactivar']"));
        Acciones.esperar(5000);
        String filaSinRecargar = Acciones.fila(administrador, cliente).getText().replaceAll("\\s+", " ");
        Evidencia.nota("usuarioFilaSinRecargar", filaSinRecargar);
        Evidencia.captura(administrador, "ad08b_usuario_desactivado_sin_recargar");

        administrador.navigate().refresh();
        Acciones.visible(administrador, By.cssSelector("table tr"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        String filaTrasRecargar = Acciones.fila(administrador, cliente).getText().replaceAll("\\s+", " ");
        Evidencia.nota("usuarioFilaTrasRecargar", filaTrasRecargar);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + cliente + "\")]"));
        Evidencia.captura(administrador, "ad08b_usuario_desactivado");

        clienteDesactivado = Navegador.escritorio();
        Acciones.ir(clienteDesactivado, "/login");
        Acciones.escribir(clienteDesactivado, By.cssSelector("input[name=username]"), cliente);
        Acciones.escribir(clienteDesactivado, By.cssSelector("input[name=password]"), Config.CLIENTE_CLAVE);
        Acciones.clic(clienteDesactivado, By.cssSelector("button[type=submit]"));
        Acciones.esperar(6000);
        Evidencia.captura(clienteDesactivado, "ad08c_login_usuario_desactivado");
        String[] intento = Acciones.api(clienteDesactivado, "POST", "/api/login/",
                "{\"username\":\"" + cliente + "\",\"password\":\"" + Config.CLIENTE_CLAVE + "\"}");
        Evidencia.nota("loginDesactivadoHttp", intento[0]);
        Evidencia.nota("loginDesactivadoCuerpo", intento[1]);

        Acciones.clic(administrador,
                By.xpath("//tr[contains(., \"" + cliente + "\")]//button[normalize-space()='Activar']"));
        Acciones.esperar(5000);
        administrador.navigate().refresh();
        Acciones.visible(administrador, By.cssSelector("table tr"), Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + cliente + "\")]"));
        Evidencia.captura(administrador, "ad08d_usuario_reactivado");
        String filaFinal = Acciones.fila(administrador, cliente).getText().replaceAll("\\s+", " ");
        Evidencia.nota("usuarioFilaReactivado", filaFinal);

        assertEquals("401", intento[0], "Un cliente desactivado no debe poder iniciar sesion");
        assertTrue(intento[1].toLowerCase().contains("desactivada"),
                "El servidor debe avisar que la cuenta esta desactivada");
        assertTrue(filaTrasRecargar.contains("Inactivo"),
                "Tras recargar, el cliente debe figurar como Inactivo");
        assertTrue(!filaFinal.contains("Inactivo"), "Al activarlo debe volver a quedar Activo");
        assertTrue(filaSinRecargar.contains("Inactivo"),
                "CP-48 FALLIDO: el estado cambia en el servidor, pero la tabla sigue mostrando '"
                        + filaSinRecargar + "' hasta recargar la pagina.");
    }
}
