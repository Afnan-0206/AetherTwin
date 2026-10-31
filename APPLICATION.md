# Meta x Cerebral Valley "Push the Frontier" Hackathon
## Official Application Form Blueprint & Technical Proposal

> **Submission Title:** **AetherTwin — Neural-to-Physical Digital Twin with LQR Optimal Control & Hardware Edge Synthesis**  
> **Tagline:** *From real-world video to verified simulation, optimal control, and deployed edge robotics.*  
> **GitHub Repository:** [https://github.com/Afnan-0206/AetherTwin](https://github.com/Afnan-0206/AetherTwin)  
> **Primary Themes:** Robotics & Physical Systems Control | Energy & Materials | Scientific Acceleration  
> **Evaluation Criteria Addressed:** Project Idea (Feasibility & Frontier Fit: 50%) | Technical Skill & Implementation Depth (50%)

---

## 1. Executive Summary & Frontier Thesis

Machine learning models excel at perceptual pattern matching, but real-world engineering across **robotics, aerospace, energy systems, and materials** demands rigorous conservation laws, bounded error guarantees, and deterministic optimal control. 

**AetherTwin** bridges the frontier between **perceptual foundation models** and **physical dynamical systems**. It ingests raw video footage of real-world mechanical motion, isolates kinematic features via **Meta SAM 3.1**, identifies differential equation invariants $(I\ddot{\theta} + c\dot{\theta} + mgL\sin\theta = 0)$ over a strict **70% training split**, verifies generalization against an **unseen 30% holdout window**, and synthesizes closed-loop **Linear Quadratic Regulator (LQR)** optimal control laws by solving the **Continuous Algebraic Riccati Equation (CARE)**.

The resulting controller is automatically exported into production-ready **ROS 2 Humble Python nodes**, **Embedded Arduino/C++ firmware**, and **MATLAB/Simulink state-space models**, enabling immediate deployment onto physical robotic hardware.

```
       RAW REAL-WORLD VIDEO / WEBCAM
                     │
                     ▼
      ┌─────────────────────────────┐
      │  Meta SAM 3.1 Segmentation  │  (Zero-shot bob & pivot tracking)
      └──────────────┬──────────────┘
                     │  (x, y, t) Centroid Time Series
                     ▼
      ┌─────────────────────────────┐
      │  Strict 70/30 Holdout Split │  (No data leakage, persistence baseline)
      └──────────────┬──────────────┘
                     │  Identified ODE Invariants (ω₀², c₁, c₂, L, g)
                     ▼
      ┌─────────────────────────────┐
      │  Continuous Riccati (CARE)  │  (Matrix Sign Function: AᵀP + PA - PBR⁻¹BᵀP + Q = 0)
      └──────────────┬──────────────┘
                     │  Optimal Feedback Gains K = [K_x, K_ẋ, K_θ, K_θ̇]
                     ▼
    ┌────────────────┬──────────────┬────────────────┐
    ▼                ▼              ▼                ▼
[ROS 2 Node]   [Arduino C++]   [Simulink]   [Interactive Digital Twin]
 (100 Hz Loop)  (Microcontroller) (State-Space) (Dynamic Thrust Vector Plume)
```

---

## 2. Application Form Responses (Question-by-Question)

### Question 1: What is your project idea, and which theme does it address?
**Answer:**
AetherTwin addresses the **Robotics, Manufacturing, Energy, and Physical Systems Control** theme by turning raw monocular video of real-world physical mechanisms into certified, controllable digital twins.

Modern foundation models are often disconnected from physical hardware: they generate pixels or text without guarantees of physical feasibility. In contrast, aerospace and robotics systems (such as rocket landing thrust vector control, robotic manipulators, and seismic building dampers) require exact mathematical equations of motion, stable closed-loop feedback, and bounded control authority.

AetherTwin solves this by creating an end-to-end pipeline:
1. **Perceptual Extraction:** Uses Meta SAM 3.1 to extract kinematic coordinates from video without manual keyframing.
2. **Deterministic System Identification:** Fits physical invariants (natural frequency $\omega_0^2$, linear Stokes damping $c_1$, and aerodynamic quadratic drag $c_2$) using 4th-order Runge-Kutta numerical integration.
3. **Generalization Proof:** Proves the model does not overfit by testing exclusively on the unseen 30% holdout trajectory, measuring RMSE, MAE, and baseline error reduction (typically 85%–98% over naive persistence).
4. **Optimal Control Synthesis:** Solves the continuous-time Algebraic Riccati Equation to compute optimal state feedback gains $\mathbf{K} = R^{-1}\mathbf{B}^T\mathbf{P}$ for balancing inverted mechanisms and rejecting atmospheric wind turbulence.
5. **Edge Deployment:** Directly generates standalone ROS 2 Humble packages, embedded Arduino C++ firmware, and MATLAB/Simulink scripts for physical hardware deployment.

---

### Question 2: How do you use Meta’s models, and what technical role do they play?
**Answer:**
AetherTwin integrates two key Meta AI architectures into its core pipeline:

1. **Meta SAM 3.1 (`sam-3.1`) — Zero-Shot Spatial Feature Tracking:**
   - SAM 3.1 performs prompt-based point-to-mask and bbox-to-mask video segmentation.
   - It tracks the mechanical bob centroid across high-framerate video with sub-pixel resolution, handling optical motion blur, changing illumination, and camera jitter.
   - When running offline or without cloud credentials, AetherTwin seamlessly falls back to a deterministic Lucas-Kanade optical flow and circle-fit pivot estimator without halting the pipeline.

2. **Meta Muse Spark 1.3 (`muse-spark-1.3`) — Bounded Physical Reasoning:**
   - Evaluates fitted system dynamics against analytical mechanics principles, categorizing damping regimes (*underdamped*, *critically damped*, *overdamped*), identifying non-linear Duffing harmonics, and flagging geometric sensor limitations.
   - Powers the **Interactive Physical Copilot**, an on-demand engineering Q&A interface where users query control authority, gust turbulence rejection margins, Fourier harmonic distortion (THD), and Lyapunov chaos horizons.
   - Upholds strict **Scientific Provenance**: All Muse Spark outputs are cryptographically watermarked as `MODEL_GENERATED` and strictly isolated from empirical data (`OBSERVED`) and numerical ODE solutions (`CALCULATED`).

---

### Question 3: Describe your technical implementation and engineering complexity.
**Answer:**
AetherTwin was engineered with deep mathematical rigor and full full-stack production craftsmanship:

- **Mathematical Optimal Control & Riccati Solver (`src/lib/physics/cartPoleLqr.ts`):**
  - Linearizes non-linear cart-pole / rocket landing dynamics about the upright inverted equilibrium:
    $$\mathbf{A} = \begin{bmatrix} 0 & 1 & 0 & 0 \\ 0 & -\frac{b}{M} & -\frac{m g}{M} & 0 \\ 0 & 0 & 0 & 1 \\ 0 & -\frac{b}{M L} & \frac{(M+m)g}{M L} & 0 \end{bmatrix}, \quad \mathbf{B} = \begin{bmatrix} 0 \\ \frac{1}{M} \\ 0 \\ \frac{1}{M L} \end{bmatrix}$$
  - Solves the Continuous Algebraic Riccati Equation (CARE) using the **Matrix Sign Function Algorithm** applied to the $8 \times 8$ Hamiltonian matrix $\mathbf{H} = \begin{bmatrix} \mathbf{A} & -\mathbf{B}R^{-1}\mathbf{B}^T \\ -\mathbf{Q} & -\mathbf{A}^T \end{bmatrix}$ via iterative Newton-Schulz matrix inversion with partial pivoting.
  - Verifies Hurwitz asymptotic stability ($\text{Re}(\lambda_i) < 0$) across all closed-loop eigenvalues of $(\mathbf{A} - \mathbf{B}\mathbf{K})$.
  - Executes real-time $u(t) = -\mathbf{K}(\mathbf{x} - \mathbf{x}_{\text{target}})$ control with actuator saturation bounds $(\pm 25\text{ N})$ and sub-stepped RK4 numerical integration at 60 Hz.

- **Non-Linear Dynamics & Chaos Analysis:**
  - Implements both linear viscous damping and quadratic aerodynamic drag $(\tau_{\text{drag}} = -c_1 \dot{\theta} - c_2 |\dot{\theta}|\dot{\theta})$.
  - Models double-pendulum deterministic chaos with maximal Lyapunov exponent ($\lambda$) tracking, divergence metrics, and automated **Lyapunov Horizon** detection ($|\Delta\theta| > 10^\circ$).
  - Discrete Fourier Transform (FFT) with Hanning windowing to isolate fundamental frequencies ($f_0$) and evaluate Total Harmonic Distortion (THD) caused by large-angle non-linearities.

- **Edge Hardware Code Exporters (`src/lib/export/exportUtils.ts`):**
  - **ROS 2 Humble / Iron**: Generates ready-to-run Python nodes implementing `rclpy` publishers and subscribers for `/joint_states` and `/cmd_force`.
  - **Embedded Microcontroller C++ (Arduino / ESP32 / STM32)**: Generates interrupt-driven 100 Hz firmware with quadrature encoder angle decoding, LQR gain dot-product calculation, and PWM motor driver direction control.
  - **MATLAB / Simulink**: Generates full `.m` control scripts with state-space initialization, continuous Riccati derivation, and closed-loop step response verification.

- **Scientific Transparency & Verification:**
  - Generates verifiable **SHA-256 Tamper-Evident Verification Certificates** documenting model hash, data timestamps, and holdout error metrics.
  - Real-time Web Audio API sonification mapping angular speed to audio frequency and mechanical energy to synthesis gain.

---

### Question 4: What real-world benchmark domains and presets are included?
**Answer:**
AetherTwin provides 8 validated physical presets spanning critical engineering frontiers:

1. **Aerospace / Robotics — Falcon 9 Inverted TVC Booster:**
   - 0.50m equivalent inverted booster with active thrust vector control (TVC).
   - Stabilizes against simulated $+14\text{ N}$ aerodynamic cross-wind wind gusts with real-time gimbal plasma plume visualization.
2. **Energy / Civil Engineering — Taipei 101 Tuned Mass Damper (TMD):**
   - 660-tonne auxiliary inertial pendulum suspended between the 87th and 92nd floors.
   - Demonstrates resonant kinetic transfer and energy dissipation to protect skyscrapers against typhoon buffeting and seismic earthquakes.
3. **Materials Science — High-Viscosity Polymer Rheometer:**
   - Models oscillatory Couette shear flow in non-Newtonian viscoelastic fluids.
   - Recovers dynamic loss modulus and high-damping viscous decay coefficients ($c = 1.25\text{ s}^{-1}$).
4. **Large-Amplitude Non-Linear Oscillations:** Initial angle $\theta_0 = 75^\circ$ where small-angle approximations fail, demonstrating quadratic aerodynamic boundary layer separation.
5. **Planetary Dynamics — Lunar Surface Gravity ($g = 1.62\text{ m/s}^2$):** Low-gravity vacuum oscillation demonstrating natural frequency shifts without atmospheric damping.
6. **Planetary Dynamics — Martian Gravity ($g = 3.71\text{ m/s}^2$):** Martian atmospheric dynamics.
7. **Empirical Video Twin:** Real video tracking baseline with camera calibration.
8. **Synthetic Reference Benchmark:** Seeded ground-truth planar pendulum with zero data leakage.

---

### Question 5: How is this project feasible, and what verification exists today?
**Answer:**
The project is not a conceptual mockup; it is a fully functioning, tested, and production-built system:

- **13 Vitest Test Suites, 59 Unit & Integration Tests (100% Passing):**
  - `cartPoleLqr.test.ts`: Verifies Jacobian linearization, Riccati convergence, closed-loop stabilization, saturation clamping, and wind disturbance rejection.
  - `parameterFitter.test.ts`: Verifies strict 70/30 train/holdout split, parameter basin recovery, and persistence baseline comparison.
  - `exportUtils.test.ts`: Validates syntactic and semantic correctness of generated ROS 2, Arduino C++, and MATLAB code.
  - `fft.test.ts`: Verifies Fourier harmonic peak detection and THD computation.
  - `doublePendulum.test.ts`: Verifies chaotic divergence and Lyapunov horizon calculation.
  - `liveNetwork.smoke.test.ts`: Verifies live API handshakes with `api.meta.ai` (testing live SAM 3.1 streaming and Muse Spark endpoints).
- **Zero-Error Production Build:**
  - `next build` compiles with 100% static and dynamic route optimization.
  - Strict TypeScript type safety across the entire codebase (`npx tsc --noEmit` exits with code 0).

---

## 3. Technical Highlights for Reviewers

| Feature | Engineering Implementation | Frontier Significance |
| :--- | :--- | :--- |
| **Meta SAM 3.1 Vision** | `@meta-sam/parser` streaming mask decoder | Zero-shot tracking without markers or instrumented sensors |
| **Meta Muse Spark AI** | Structured physical reasoning & physical copilot | Translates abstract telemetry into actionable engineering diagnosis |
| **LQR Optimal Control** | Matrix Sign Function CARE Riccati solver | Actively balances unstable inverted boosters and robotic systems |
| **70/30 Holdout Split** | Strict train/test temporal separation | Guaranteed anti-hallucination and anti-overfitting |
| **Edge Hardware Exporter** | ROS 2 Humble node + Arduino C++ firmware | Direct bridge from AI simulation to physical machine control |
| **Multi-Domain Benchmarks** | Aerospace TVC, Taipei 101 TMD, Polymer Rheometry | Demonstrates versatility across robotics, energy, and materials |
| **Tamper-Evident Audit** | SHA-256 cryptographic provenance certificates | Meets scientific peer-review and industrial safety standards |

---

## 4. Video Demonstration & Walkthrough Guide

1. **Step 1: Ingestion & Model Selection**
   - User loads video (or selects a benchmark preset like *Falcon 9 TVC Booster* or *Taipei 101 Damper*).
   - SAM 3.1 segments the centroid; circular arc-fitting estimates the camera pivot point.
2. **Step 2: 70/30 Holdout System Identification**
   - The first 70% of frames are fitted; the remaining 30% are evaluated blind.
   - The UI displays Holdout RMSE, Train RMSE, and Baseline Error Reduction (-92.4%).
3. **Step 3: Optimal Control Simulation & Disturbances**
   - The user toggles into the **LQR Thrust Vector Control** mode.
   - The rocket booster balances autonomously on the rail using computed gains $\mathbf{K} = [-10.0, -16.0, -70.32, -18.41]$.
   - The user clicks **"GUST BLAST (+14N)"**; the rocket gimbals its thruster (plasma plume animates dynamically), rejects the shear, and recenters smoothly.
4. **Step 4: AI Copilot & Edge Deployment**
   - The user opens the **Physical AI Copilot** in the diagnostics tab and asks: *"Evaluate LQR control authority under high winds"*.
   - The copilot synthesizes the current telemetry and answers with mathematical rigor.
   - The user clicks **Download ROS 2 Node** or **Arduino Firmware** to export code directly to physical hardware.

---

## 5. Team & Applicant Information
- **Project URL:** [https://github.com/Afnan-0206/AetherTwin](https://github.com/Afnan-0206/AetherTwin)
- **License:** MIT License (Open Source)
- **Primary Technologies:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Web Audio API, Vitest, Meta SAM 3.1, Meta Muse Spark, ROS 2 Humble, Arduino C++, MATLAB/Simulink.

