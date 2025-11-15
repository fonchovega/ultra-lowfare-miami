// ============================================
// Ultra-Low Fare · FrontDesk mínimo (v1.3.3)
// Lee data/historico*.json y muestra:
//   - Estado general de la base
//   - Resumen del último barrido
//   - Tabla rápida de histórico
// ============================================

var ulfData = [];
var ulfLastSample = null;

function setTextById(id, text) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function setHtmlById(id, html) {
  var el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  }
}

// Intenta cargar el histórico desde varias rutas posibles
function loadHistorico() {
  var urls = [
    '../data/historico_fixed.json',
    '../data/historico.json',
    'data/historico_fixed.json',
    'data/historico.json'
  ];

  var index = 0;

  function tryNext() {
    if (index >= urls.length) {
      // No se pudo cargar nada
      setTextById('pill-source', 'Sin datos disponibles');
      setTextById('footer-data-source', 'Fuente: sin datos');
      setTextById('badge-ultima-ejecucion', 'Sin datos');
      return;
    }

    var url = urls[index];
    index += 1;

    fetch(url)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Respuesta no OK');
        }
        return res.json();
      })
      .then(function (json) {
        if (!Array.isArray(json)) {
          throw new Error('El JSON no es un array');
        }
        ulfData = json;
        processHistorico(url);
      })
      .catch(function () {
        // Probar siguiente ruta
        tryNext();
      });
  }

  tryNext();
}

// Procesa la data cargada
function processHistorico(sourceUrl) {
  setTextById('pill-source', 'Fuente: ' + sourceUrl);
  setTextById('footer-data-source', 'Fuente: ' + sourceUrl);

  var total = ulfData.length;
  if (total === 0) {
    setTextById('stat-total-registros', '0');
    setTextById('badge-ultima-ejecucion', 'Sin registros');
    return;
  }

  ulfLastSample = ulfData[total - 1];

  // Estado general
  setTextById('stat-total-registros', String(total));

  var meta = ulfLastSample.meta || {};
  var fecha = meta.generado || meta.fecha || 'N/D';
  var zona = meta.zona_horaria || meta.timezone || 'N/D';

  setTextById('stat-ultima-fecha', fecha);
  setTextById('stat-ultima-zona', 'Zona horaria: ' + zona);

  var rutas = meta.rutas;
  if (Array.isArray(rutas) && rutas.length > 0) {
    setTextById('stat-rutas', rutas.join(' · '));
  } else {
    setTextById('stat-rutas', 'No definido en meta.rutas');
  }

  setTextById('badge-ultima-ejecucion', 'Último barrido: ' + fecha);

  renderLastRunSummary();
  renderHistoryTable();
}

// Normaliza un item de resumen a un formato común
function mapResumenItem(item) {
  if (!item || typeof item !== 'object') {
    return {
      ruta: 'N/D',
      precio: null,
      umbral: null,
      statusFlag: null,
      statusText: 'N/D'
    };
  }

  var ruta = item.ruta || item.destino || item.route || 'N/D';

  var precio = null;
  if (typeof item.precio === 'number') {
    precio = item.precio;
  } else if (typeof item.precio_mas_bajo_usd === 'number') {
    precio = item.precio_mas_bajo_usd;
  } else if (typeof item.precio_encontrado === 'number') {
    precio = item.precio_encontrado;
  }

  var umbral = null;
  if (typeof item.umbral === 'number') {
    umbral = item.umbral;
  } else if (typeof item.umbral_usd === 'number') {
    umbral = item.umbral_usd;
  } else if (typeof item.limite === 'number') {
    umbral = item.limite;
  }

  var rawEstado = item.cumple || item.resultado || item.estado || '';
  var estadoStr = String(rawEstado || '').trim();
  var lower = estadoStr.toLowerCase();

  var flag = null;
  var texto = estadoStr || 'N/D';

  if (lower.indexOf('cumple') !== -1 && lower.indexOf('no') === -1 && lower.indexOf('❌') === -1) {
    flag = true;
    if (texto === 'true' || texto === '') {
      texto = 'Cumple';
    }
  } else if (lower === '' || lower === 'null' || lower === 'undefined') {
    flag = null;
    texto = 'N/D';
  } else {
    flag = false;
    if (texto === 'false' || texto === '') {
      texto = 'No cumple';
    }
  }

  return {
    ruta: ruta,
    precio: precio,
    umbral: umbral,
    statusFlag: flag,
    statusText: texto
  };
}

// Renderiza tarjetas del último barrido
function renderLastRunSummary() {
  var contenedor = document.getElementById('last-run-summary');
  if (!contenedor) {
    return;
  }

  var resumen = (ulfLastSample && ulfLastSample.resumen) ? ulfLastSample.resumen : [];
  if (!Array.isArray(resumen) || resumen.length === 0) {
    contenedor.innerHTML = '<p class="ulf-helper-text">El último registro no tiene campo "resumen".</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < resumen.length; i++) {
    var mapped = mapResumenItem(resumen[i]);
    var precioTxt = mapped.precio != null ? mapped.precio.toFixed(0) : 'N/D';
    var umbralTxt = mapped.umbral != null ? mapped.umbral.toFixed(0) : 'N/D';

    var chipClass = 'ulf-chip ulf-chip-nd';
    if (mapped.statusFlag === true) {
      chipClass = 'ulf-chip ulf-chip-ok';
    } else if (mapped.statusFlag === false) {
      chipClass = 'ulf-chip ulf-chip-bad';
    }

    html +=
      '<article class="ulf-card">' +
        '<h3>' + mapped.ruta + '</h3>' +
        '<p class="ulf-metric">US$ ' + precioTxt + '</p>' +
        '<p class="ulf-helper-text">Umbral: US$ ' + umbralTxt + '</p>' +
        '<p class="ulf-helper-text">' +
          '<span class="' + chipClass + '">' + mapped.statusText + '</span>' +
        '</p>' +
      '</article>';
  }

  contenedor.innerHTML = html;
}

// Construye filas de histórico (últimos N registros)
function buildHistoryRows(limit) {
  var rows = [];
  if (!Array.isArray(ulfData) || ulfData.length === 0) {
    return rows;
  }

  for (var i = ulfData.length - 1; i >= 0; i--) {
    var sample = ulfData[i];
    var meta = sample.meta || {};
    var fecha = meta.generado || meta.fecha || '';
    var resumen = Array.isArray(sample.resumen) ? sample.resumen : [];

    for (var j = 0; j < resumen.length; j++) {
      var mapped = mapResumenItem(resumen[j]);
      rows.push({
        fecha: fecha || 'N/D',
        ruta: mapped.ruta,
        precio: mapped.precio,
        umbral: mapped.umbral,
        statusFlag: mapped.statusFlag,
        statusText: mapped.statusText
      });

      if (rows.length >= limit) {
        return rows;
      }
    }
  }

  return rows;
}

// Renderiza tabla de histórico
function renderHistoryTable() {
  var tbody = document.querySelector('#history-table tbody');
  if (!tbody) {
    return;
  }

  var select = document.getElementById('rows-select');
  var limit = 25;
  if (select) {
    var v = parseInt(select.value, 10);
    if (!isNaN(v) && v > 0) {
      limit = v;
    }
  }

  var rows = buildHistoryRows(limit);
  if (rows.length === 0) {
    tbody.innerHTML =
      '<tr>' +
        '<td colspan="5">No hay filas para mostrar (revisar campo "resumen" en data/historico*.json).</td>' +
      '</tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var precioTxt = r.precio != null ? r.precio.toFixed(0) : 'N/D';
    var umbralTxt = r.umbral != null ? r.umbral.toFixed(0) : 'N/D';

    var chipClass = 'ulf-chip ulf-chip-nd';
    if (r.statusFlag === true) {
      chipClass = 'ulf-chip ulf-chip-ok';
    } else if (r.statusFlag === false) {
      chipClass = 'ulf-chip ulf-chip-bad';
    }

    html +=
      '<tr>' +
        '<td>' + r.fecha + '</td>' +
        '<td>' + r.ruta + '</td>' +
        '<td>' + precioTxt + '</td>' +
        '<td>' + umbralTxt + '</td>' +
        '<td><span class="' + chipClass + '">' + r.statusText + '</span></td>' +
      '</tr>';
  }

  tbody.innerHTML = html;
}

// Inicialización
window.addEventListener('DOMContentLoaded', function () {
  var select = document.getElementById('rows-select');
  if (select) {
    select.addEventListener('change', function () {
      renderHistoryTable();
    });
  }

  loadHistorico();
});
