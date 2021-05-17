<script>
  import Card from "./Card.svelte";
  import { onMount } from "svelte";
  import {
    Chart,
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Legend,
    Tooltip,
  } from "chart.js";

  Chart.register(
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Legend,
    Tooltip
  );

  const data = {
    labels: ["Find Primes", "Jimp", "Fib"],
    datasets: [
      {
        label: "Clio",
        data: [42, 5.3, 4.1],
        borderColor: "rgba(68,71,90,1)",
        backgroundColor: "#2b82d4cc",
        borderRadius: {
          topLeft: 3,
          topRight: 3,
        },
      },
      {
        label: "Clio (Parallel)",
        data: [139, 23.6, 10.2],
        borderColor: "rgba(68,71,90,1)",
        backgroundColor: "#4f29f0cc",
        borderRadius: {
          topLeft: 3,
          topRight: 3,
        },
      },
      {
        label: "JavaScript",
        data: [41, 5.2, 3.9],
        borderColor: "rgba(68,71,90,1)",
        backgroundColor: "#b5cea7cc",
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
            return [context.dataset.label, context.raw, "ops/s"].join(" ");
          },
        },
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
        <canvas id="chart" />
      </div>
      <div class="body">
        <h3>Clio is fast!</h3>
        <div class="explanation">
          <p>
            About the same performance as JavaScript, more or less. However,
            using Clio's microservices and parallelism features you can boost
            the performance by a few hundred to a few thousand percents!
          </p>
          <p>
            Clio uses worker threads on Node.js and web workers on the browsers.
            Additionally, you can use network resources over WebSockets, TCP,
            Unix sockets and several other protocols.
          </p>
        </div>
        <div class="actions">
          <a class="btn" href="https://docs.clio-lang.org/rpc/rpc">
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
    border-radius: 2em;
    box-shadow: 0px 0px 16px 1px rgb(0 0 0 / 40%);
    transition: cubic-bezier(0.39, 0.575, 0.565, 1) all 0.2s;
  }
  .chart {
    width: 50%;
    box-sizing: border-box;
    padding: 1em;
  }
  .btn:hover {
    transform: scale(1.1);
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
