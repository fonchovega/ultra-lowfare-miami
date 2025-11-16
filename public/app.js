// FrontDesk v1.3.4
// Lee historico_normalizado.json (si existe) o historico.json
// y pinta métricas básicas en el dashboard.

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function setStatus(status, mode) {
  var el = document.getElementById("statusBadge");
  if (!el) {
    return;
  }

  el.classList.remove("ok");
  el.classList.remove("warn");
  el.classList.remove("err");

  if (mode === "ok") {
    el.classList.add("ok");
  } else if (mode === "err") {
    el.classList.add("err");
  } else {
    el.classList.add("warn");
  }

  el.textContent = status;
}

function showError(msg) {
  var box = document.getElementById("errorBox");
  if (!box) {
    return;
  }
  box.style.display = "block";
  box.textContent = msg;
}

function hideError() {
  var box = document.getElementById("errorBox");
  if (!box) {
    return;
  }
  box.style.display = "none";
  box.textContent = "";
}

function ensureArray(json) {
  if (!json) {
    return [];
  }
  if (Array.isArray(json)) {
    return json;
  }
  if (json.data && Array.isArray(json.data)) {
    return json.data;
  }
  return [];
}

function attachSource(arr, source) {
  try {
    arr.__source = source;
  } catch (e) {
    // ignorar si no se puede adjuntar
  }
  return arr;
}

function getSourceLabel(arr) {
  if (arr && arr.__source) {
    return "Origen: " + arr.__source;
  }
  return "Origen: desconocido";
}

function safeFetchJson(url) {
  return fetch(url + "?_ts=" + Date.now())
    .then(function (resp) {
      if (!resp.ok) {
        return null;
      }
      return resp.json();
    })
    .then(function (json) {
      if (!json) {
        return null;
      }
      var arr = ensureArray(json);
      if (!arr || !arr.length) {
        return null;
      }
      return attachSource(arr, url);
    })
    .catch(function () {
      return null;
    });
}

function tryLoadData() {
  // 1) Intentar historico_normalizado
  return safeFetchJson("./data/historico_normalizado.json").then(function (normalized) {
    if (normalized && normalized.length) {
      return normalized;
    }
    // 2) Fallback a historico.json
    return safeFetchJson("./data/historico.json").then(function (raw) {
      if (raw && raw.length) {
        return raw;
      }
      return [];
    });
  });
}

function buildRoutesTable(lastSnapshot) {
  var tbody = document.getElementById("routesTableBody");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  if (!lastSnapshot || !lastSnapshot.resumen || !lastSnapshot.resumen.length) {
    var trEmpty = document.createElement("tr");
    var tdEmpty = document.createElement("td");
    tdEmpty.colSpan = 6;
    tdEmpty.textContent = "No hay resumen disponible para el último snapshot.";
    trEmpty.appendChild(tdEmpty);
    tbody.appendChild(trEmpty);
    return;
  }

  lastSnapshot.resumen.forEach(function (item) {
    var tr = document.createElement("tr");

    var ruta = item.ruta || "-";
    var salida = item.salida || "-";
    var retorno = item.retorno || "-";

    var umbral = "-";
    if (typeof item.umbral !== "undefined" && item.umbral !== null) {
      umbral = item.umbral;
    } else if (typeof item.umbral_usd !== "undefined" && item.umbral_usd !== null) {
      umbral = item.umbral_usd;
    }

    var precio = "-";
    if (typeof item.precio !== "undefined" && item.precio !== null) {
      precio = item.precio;
    } else if (
      typeof item.precio_mas_bajo_usd !== "undefined" &&
      item.precio_mas_bajo_usd !== null
    ) {
      precio = item.precio_mas_bajo_usd;
    }

    var estado = item.cumple || item.resultado || "-";

    var tdRuta = document.createElement("td");
    tdRuta.textContent = ruta;

    var tdSalida = document.createElement("td");
    tdSalida.textContent = salida;

    var tdRetorno = document.createElement("td");
    tdRetorno.textContent = retorno;

    var tdUmbral = document.createElement("td");
    tdUmbral.textContent = umbral;

    var tdPrecio = document.createElement("td");
    tdPrecio.textContent = precio;

    var tdEstado = document.createElement("td");
    var spanEstado = document.createElement("span");
    spanEstado.className = "pill";

    var estadoUpper = (estado || "-").toString().toUpperCase();

    spanEstado.textContent = estado;

    if (estadoUpper === "CUMPLE" || estadoUpper === "OK" || estadoUpper === "✔") {
      spanEstado.style.borderColor = "#16a34a";
      spanEstado.style.color = "#bbf7d0";
    } else if (estadoUpper.indexOf("NO CUMPLE") !== -1 || estadoUpper === "❌") {
      spanEstado.style.borderColor = "#dc2626";
      spanEstado.style.color = "#fecaca";
    } else {
      spanEstado.style.borderColor = "#4b5563";
      spanEstado.style.color = "#e5e7eb";
    }

    tdEstado.appendChild(spanEstado);

    tr.appendChild(tdRuta);
    tr.appendChild(tdSalida);
    tr.appendChild(tdRetorno);
    tr.appendChild(tdUmbral);
    tr.appendChild(tdPrecio);
    tr.appendChild(tdEstado);

    tbody.appendChild(tr);
  });
}

function initDashboard() {
  hideError();
  setStatus("Cargando…", "warn");
  setText("totalSnapshots", "—");
  setText("lastUpdated", "—");
  setText("dataSourceLabel", "Origen de datos: —");

  tryLoadData()
    .then(function (data) {
      if (!data || !data.length) {
        setStatus("SIN DATOS", "err");
        showError("No se encontraron datos ni en historico_normalizado.json ni en historico.json.");
        return;
      }

      setStatus("OK", "ok");
      setText("totalSnapshots", String(data.length));
      setText("dataSourceLabel", getSourceLabel(data));

      var last = data[data.length - 1];
      var lastMeta = last && last.meta ? last.meta : null;
      var generado = lastMeta && lastMeta.generado ? lastMeta.generado : "N/D";

      setText("lastUpdated", generado);
      buildRoutesTable(last);
    })
    .catch(function () {
      setStatus("ERROR", "err");
      showError("Error inesperado al procesar los datos del histórico.");
    });
}

document.addEventListener("DOMContentLoaded", function () {
  initDashboard();
});
