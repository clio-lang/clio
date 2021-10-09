<script>
  import Card from "./Card.svelte";
  import { onMount } from "svelte";
  import {
    Chart,
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
  } from "chart.js";
  import ChartDataLabels from "chartjs-plugin-datalabels";

  import { PastelOne9 as colors } from "../colorschemes/colorschemes.brewer.js";

  Chart.register(
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    ChartDataLabels
  );

  Chart.defaults.set("plugins.datalabels", {
    anchor: "end",
    align: "end",
    formatter(value) {
      return (
        Math.floor(value / 1000) +
        "," +
        (value % 1000).toString().padStart(3, "0") +
        "ns"
      );
    },
  });

  const data = {
    labels: ["C", "Clio", "JavaScript", "PyPy", "Python"],
    datasets: [
      {
        label: "Fib(1000)",
        data: [1011, 1082, 9961, 22888, 161886],
        borderColor: "rgba(68,71,90,1)",
        backgroundColor: colors,
        borderRadius: {
          topLeft: 3,
          topRight: 3,
        },
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            return [context.dataset.label, context.raw, "ns"].join(" ");
          },
        },
      },
    },
    scales: {
      y: {
        suggestedMax: 165000,
      },
    },
  };

  onMount(async () => {
    const ctx = document.getElementById("chart").getContext("2d");
    const chart = new Chart(ctx, {
      type: "bar",
      data,
      options,
    });
  });
</script>

<div class="title">
  <h2>Performance</h2>
</div>

<div class="performance">
  <Card>
    <div class="inner">
      <div class="chart">
        <h3>Fib(1000) best of 10k loops</h3>
        <canvas id="chart" />
        <div class="footer">
          <div class="compilers">
            Clang 12.0.5, Clio 0.11.0, Node 16.9.1, PyPy 7.3.5, Python 3.9.7
          </div>
        </div>
      </div>
      <div class="body">
        <h3>Clio is fast!</h3>
        <div class="explanation">
          <p>
            A lot of time and effort has been spent on optimizing Clio and
            making it faster. Clio compiler applies compile time optimizations
            to the generated code, furthermore this generated code is JIT
            compiled using the V8 engine, making Clio a super fast language.
          </p>
          <p>
            In the performance chart you can see how fast Clio realy is. This
            result is accomplished thanks to the tail call optimizations applied
            to the Fibonacci function, making it almost as fast as the C
            implementation.
          </p>
          <p>
            Additionally, Clio offers easy to use multi-threading, distributed
            programming, micro-services and function-as-a-service on both the
            browser and the server side. You can use all resources on the local
            machine, as well as resources available to you over the network;
            Clio scales indefinitely.
          </p>
        </div>
        <div class="actions">
          <a
            class="btn"
            href="https://docs.clio-lang.org/versions/develop/reference/performance.html"
          >
            Learn more!
          </a>
        </div>
      </div>
    </div>
  </Card>
</div>

<style>
  h2 {
    color: rgb(204 42 64);
    font-size: 3em;
    margin-bottom: 1em;
  }
  .title {
    max-width: 1280px;
    margin: 0 auto;
  }
  .performance {
    max-width: 1280px;
    margin: 0 auto;
  }
  .inner {
    display: flex;
    flex-wrap: wrap;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1em;
  }
  .explanation {
    flex: 1;
  }
  a:not(.btn) {
    color: rgb(33, 33, 33);
    border-bottom: 1px dotted rgba(33, 33, 33, 0.4);
    text-decoration: none;
    padding-bottom: 2px;
    margin-bottom: -3px;
    transition: cubic-bezier(0.23, 1, 0.32, 1) color 0.17s;
  }
  a:not(.btn):hover {
    color: rgb(204, 42, 64);
    border-bottom: 2px solid rgb(204, 42, 64);
    padding-bottom: 2px;
    margin-bottom: -4px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    gap: 2em;
    flex-wrap: wrap;
  }
  .btn {
    padding: 1em 2em;
    border-radius: 7px;
    color: rgb(33, 33, 33);
    text-decoration: none;
    background: #4f29f0;
    color: #fff;
    border-radius: 10px;
    box-shadow: 0px 0px 16px 1px rgb(0 0 0 / 40%);
    transition: cubic-bezier(0.39, 0.575, 0.565, 1) all 0.2s;
  }
  .chart {
    width: 50%;
    box-sizing: border-box;
    padding: 1em;
  }
  h3 {
    margin: 0;
    margin-bottom: 0.5em;
  }
  .btn:hover {
    transform: scale(1.1);
  }
  .compilers {
    color: #777;
    font-size: 0.8em;
    margin: 1em;
    font-style: italic;
  }
  @media (max-width: 960px) {
    .performance {
      padding: 1em;
    }
  }
  @media (max-width: 640px) {
    .performance {
      padding: 1em;
      margin-bottom: 1em;
    }
    .chart {
      width: 100%;
    }
    .title {
      text-align: center;
    }
    .inner > div {
      padding: 0;
    }
    h2 {
      margin: 0.5em;
    }
  }
</style>
