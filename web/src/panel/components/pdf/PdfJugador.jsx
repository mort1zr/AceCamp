import ReportePdf, {
  PdfBarras,
  PdfKpis,
  PdfLinea,
  PdfSeccion,
  PdfVacio,
} from "./ReportePdf.jsx";
import { PdfApilada, PdfMapaCalor, PdfRadar } from "./PdfGraficos.jsx";
import { iniciales, nombreArchivo } from "../../lib/reportePdf.js";
import { useUnidades } from "../../hooks/useUnidades.js";
import {
  completeDashboardMetricDefinitions,
  isDashboardMetricValue,
} from "../../lib/dashboardOverview.js";
import {
  formatMatchDate,
  selectEvolutionPoints,
} from "../../lib/dashboardEvolution.js";
import { resultadoDelPartido } from "../../lib/partido.js";
import { playerAge } from "../../lib/players.js";
import { valoracionJugador } from "../../lib/valoracion.js";
import { convertirVelocidad, etiquetaVelocidad } from "../../lib/unidades.js";

const cifra = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const cambio = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function tendencia(metrica, valor, anterior, unidades) {
  if (!isDashboardMetricValue(metrica, anterior))
    return "Sin periodo anterior para comparar";
  const diferencia = valor - anterior;
  const mostrada = metrica.speed
    ? convertirVelocidad(diferencia, unidades)
    : diferencia;
  const unidad = metrica.speed
    ? ` ${etiquetaVelocidad(unidades)}`
    : metrica.unit === "%"
      ? " p. p."
      : metrica.unit
        ? ` ${metrica.unit}`
        : "";
  return `${cambio.format(mostrada)}${unidad} vs. periodo anterior`;
}

function Evolucion({
  titulo,
  evolucion,
  playerId,
  metrica,
  unidades,
  color,
  ancho,
}) {
  const puntos = selectEvolutionPoints(evolucion, playerId, metrica).map(
    (punto) => ({
      clave: punto.matchId,
      etiqueta: formatMatchDate(punto.date, true),
      valor:
        punto[metrica] == null
          ? null
          : convertirVelocidad(punto[metrica], unidades),
    }),
  );
  return (
    <PdfSeccion
      titulo={titulo}
      nota={`${etiquetaVelocidad(unidades)} por partido, ordenado por fecha`}
    >
      <div className="rp-tarjeta">
        {puntos.some((punto) => punto.valor != null) ? (
          <PdfLinea
            puntos={puntos}
            color={color}
            titulo={titulo}
            ancho={ancho}
          />
        ) : (
          <PdfVacio>Todavía no hay partidos con esta medición.</PdfVacio>
        )}
      </div>
    </PdfSeccion>
  );
}

export default function PdfJugador({
  player,
  report,
  periodo,
  organizacion,
  sample,
  onTerminar,
}) {
  const unidades = useUnidades();
  const nombre = player.fullName?.trim() || "Sin nombre";
  const edad = playerAge(player.birthDate);
  const comparar = periodo.value !== "all";
  const etiquetaPeriodo = comparar ? periodo.label : "Todos los partidos";
  const metricas = report?.metrics;
  const ultimo =
    report?.latestMatch?.playerId === player.id ? report.latestMatch : null;
  const { serve, rallies, movement } = report?.details ?? {};

  const valoracion = valoracionJugador(player, metricas);
  const ejes = [
    ...valoracion.atributos,
    { clave: "NIV", nombre: "Nivel UTR", valor: valoracion.nivel },
  ];
  const resultadoUltimo = resultadoDelPartido(ultimo?.result);
  const saqueCompleto =
    serve?.attempts > 0 &&
    [serve.firstIn, serve.secondIn, serve.doubleFaults].every(
      (valor) => valor != null,
    );
  const porcentajeSaque = (valor) => Math.round((valor / serve.attempts) * 100);
  const totalPeloteos = ["short", "medium", "long"].every(
    (clave) => rallies?.[clave] != null,
  )
    ? rallies.short + rallies.medium + rallies.long
    : null;
  const porcentajePeloteo = (valor) =>
    totalPeloteos > 0 && valor != null ? (valor / totalPeloteos) * 100 : null;
  const velocidadSaque = (etiqueta, valor) => ({
    etiqueta,
    valor: Number.isFinite(valor)
      ? cifra.format(convertirVelocidad(valor, unidades))
      : null,
    unidad: etiquetaVelocidad(unidades),
  });

  const kpis = completeDashboardMetricDefinitions.map((metrica) => {
    const valor = metricas?.[metrica.key];
    const valido = isDashboardMetricValue(metrica, valor);
    return {
      etiqueta: metrica.label,
      valor: valido
        ? cifra.format(
            metrica.speed ? convertirVelocidad(valor, unidades) : valor,
          )
        : null,
      unidad: metrica.speed ? etiquetaVelocidad(unidades) : metrica.unit,
      tendencia:
        comparar && valido
          ? tendencia(
              metrica,
              valor,
              report?.previousMetrics?.[metrica.key],
              unidades,
            )
          : undefined,
    };
  });

  const encabezado = (
    <section className="rp-portada">
      <span className="rp-avatar" aria-hidden="true">
        {iniciales(nombre)}
      </span>
      <div>
        <p className="rp-eyebrow">Reporte del jugador · {etiquetaPeriodo}</p>
        <h1>{nombre}</h1>
        <ul className="rp-chips">
          <li>{edad == null ? "Edad sin registrar" : `${edad} años`}</li>
          <li>{player.academy || "Sin academia registrada"}</li>
          {player.category && <li>{player.category}</li>}
          {player.dominantHand && (
            <li className="capitalize">{player.dominantHand}</li>
          )}
          {player.backhand && <li>Revés a {player.backhand}</li>}
          {sample && <li>Datos de ejemplo</li>}
        </ul>
      </div>
    </section>
  );

  return (
    <ReportePdf
      tipo="Reporte del jugador"
      organizacion={organizacion}
      archivo={nombreArchivo(
        "Reporte",
        nombre,
        periodo.value === "all" ? "" : periodo.label,
      )}
      encabezado={encabezado}
      onTerminar={onTerminar}
    >
      <div className="rp-una">
        <PdfSeccion
          titulo="Resumen de rendimiento"
          nota={
            comparar
              ? `Comparado con el periodo anterior (${periodo.label.toLowerCase()})`
              : "Todos los partidos analizados"
          }
        >
          <PdfKpis items={kpis} />
        </PdfSeccion>

        <PdfSeccion
          titulo="Perfil de juego"
          nota="Valoración de 0 a 99 a partir de sus partidos analizados y su UTR"
        >
          {valoracion.media == null ? (
            <PdfVacio>
              La valoración aparecerá cuando tenga partidos analizados.
            </PdfVacio>
          ) : (
            <div className="rp-perfil">
              <div>
                <p className="rp-valoracion">
                  {valoracion.media}
                  <small>Valoración</small>
                </p>
                <PdfBarras
                  filas={ejes.map((eje) => ({
                    etiqueta: eje.nombre,
                    valor: eje.valor,
                  }))}
                />
              </div>
              <PdfRadar ejes={ejes} />
            </div>
          )}
        </PdfSeccion>

        <div className="rp-columnas">
          <Evolucion
            ancho={460}
            titulo="Velocidad de golpe"
            evolucion={report?.evolution}
            playerId={player.id}
            metrica="averageShotSpeed"
            unidades={unidades}
            color="#00708f"
          />
          <Evolucion
            ancho={460}
            titulo="Velocidad de saque"
            evolucion={report?.serveEvolution}
            playerId={player.id}
            metrica="averageServeSpeed"
            unidades={unidades}
            color="#d0623a"
          />
        </div>

        <div className="rp-columnas">
          <PdfSeccion titulo="Saque" nota="Resultado de cada punto al saque">
            <div className="rp-tarjeta">
              {saqueCompleto ? (
                <PdfApilada
                  segmentos={[
                    {
                      etiqueta: "1er saque adentro",
                      porcentaje: porcentajeSaque(serve.firstIn),
                      color: "azul",
                    },
                    {
                      etiqueta: "2do saque adentro",
                      porcentaje: porcentajeSaque(serve.secondIn),
                      color: "oliva",
                    },
                    {
                      etiqueta: "Doble falta",
                      porcentaje: porcentajeSaque(serve.doubleFaults),
                      color: "arcilla",
                    },
                  ]}
                />
              ) : (
                <PdfVacio>
                  Sin datos de los resultados al saque para este periodo.
                </PdfVacio>
              )}
              <p className="rp-subtitulo">Velocidad del saque</p>
              <PdfKpis
                items={[
                  velocidadSaque(
                    "Primer saque · prom.",
                    serve?.first?.averageSpeedKmh,
                  ),
                  velocidadSaque(
                    "Primer saque · máx.",
                    serve?.first?.maxSpeedKmh,
                  ),
                  velocidadSaque(
                    "Segundo saque · prom.",
                    serve?.second?.averageSpeedKmh,
                  ),
                  velocidadSaque(
                    "Segundo saque · máx.",
                    serve?.second?.maxSpeedKmh,
                  ),
                ]}
              />
            </div>
          </PdfSeccion>
          <PdfSeccion
            titulo="Peloteos"
            nota={`Distribución por largo · ${rallies?.coveredMatches ?? 0} de ${rallies?.totalMatches ?? 0} análisis con datos`}
          >
            <div className="rp-tarjeta">
              <PdfBarras
                sufijo="%"
                filas={[
                  {
                    etiqueta: "Cortos (0–4)",
                    valor: porcentajePeloteo(rallies?.short),
                  },
                  {
                    etiqueta: "Medios (5–8)",
                    valor: porcentajePeloteo(rallies?.medium),
                  },
                  {
                    etiqueta: "Largos (9+)",
                    valor: porcentajePeloteo(rallies?.long),
                  },
                ]}
              />
              <p className="rp-subtitulo">Duración</p>
              <PdfKpis
                items={[
                  {
                    etiqueta: "Peloteo promedio",
                    valor:
                      rallies?.averageShots == null
                        ? null
                        : cifra.format(rallies.averageShots),
                    unidad: "golpes",
                  },
                  {
                    etiqueta: "Peloteo más largo",
                    valor:
                      rallies?.longestShots == null
                        ? null
                        : cifra.format(rallies.longestShots),
                    unidad: "golpes",
                  },
                ]}
              />
            </div>
          </PdfSeccion>
        </div>

        <div className="rp-columnas">
          <PdfSeccion
            titulo="Último partido"
            nota={ultimo ? formatMatchDate(ultimo.date) : undefined}
          >
            {ultimo ? (
              <div className="rp-tarjeta">
                <p className="rp-rival">
                  vs. {ultimo.opponent || "Rival sin registrar"}
                  {resultadoUltimo && (
                    <span className="rp-insignia">
                      {resultadoUltimo === "gano" ? "Ganó" : "Perdió"}
                    </span>
                  )}
                </p>
                {ultimo.result && (
                  <p className="rp-marcador">{ultimo.result}</p>
                )}
                {ultimo.tournament && (
                  <p className="rp-nota">{ultimo.tournament}</p>
                )}
                <PdfKpis
                  items={[
                    velocidadSaque("Saque máx.", ultimo.serveMaxSpeed),
                    {
                      etiqueta: "1er saque",
                      valor:
                        ultimo.firstServeRate == null
                          ? null
                          : cifra.format(Math.round(ultimo.firstServeRate)),
                      unidad: "%",
                    },
                    {
                      etiqueta: "Dobles faltas",
                      valor:
                        ultimo.doubleFaults == null
                          ? null
                          : String(ultimo.doubleFaults),
                    },
                    {
                      etiqueta: "Peloteo más largo",
                      valor:
                        ultimo.longestRally == null
                          ? null
                          : String(ultimo.longestRally),
                      unidad: "golpes",
                    },
                  ]}
                />
              </div>
            ) : (
              <PdfVacio>No hay partidos analizados en este periodo.</PdfVacio>
            )}
          </PdfSeccion>
          <PdfSeccion titulo="Físico y movimiento">
            <div className="rp-tarjeta">
              {movement?.heatmap && <PdfMapaCalor heatmap={movement.heatmap} />}
              <PdfKpis
                items={[
                  {
                    etiqueta: "Distancia / partido",
                    valor:
                      movement?.distancePerMatch == null
                        ? null
                        : movement.distancePerMatch >= 1000
                          ? cifra.format(movement.distancePerMatch / 1000)
                          : cifra.format(Math.round(movement.distancePerMatch)),
                    unidad: movement?.distancePerMatch >= 1000 ? "km" : "m",
                  },
                  velocidadSaque("Velocidad máx.", movement?.maxSpeedKmh),
                  velocidadSaque("Velocidad prom.", movement?.averageSpeedKmh),
                ]}
              />
            </div>
          </PdfSeccion>
        </div>
      </div>
    </ReportePdf>
  );
}
