/**
 * Cyber-Physical Digital Twin Archetypes
 * Extends verified Lagrangian dynamics and optimal control across key industrial domains:
 * Aerospace (Booster TVC), Industrial Logistics (Gantry Crane), Robotics (Prosthetic Joint),
 * and Multi-Link Chaotic Manipulators.
 */

export type TwinArchetypeId =
  | 'booster_tvc'
  | 'gantry_crane'
  | 'robotic_joint'
  | 'cart_pole'
  | 'double_pendulum'
  | 'single_pendulum';

export interface TwinArchetype {
  id: TwinArchetypeId;
  name: string;
  category: 'Aerospace' | 'Industrial Robotics' | 'Biomedical' | 'Classical Benchmark';
  tagline: string;
  description: string;
  actuatorType: string;
  stateLabels: [string, string, string, string];
  stateUnits: [string, string, string, string];
  actuatorUnit: string;
  keyMetricLabel: string;
  recommendedQ: [number, number, number, number];
  recommendedR: number;
  disturbanceLabel: string;
  disturbanceMagnitude: number;
}

export const TWIN_ARCHETYPES: Record<TwinArchetypeId, TwinArchetype> = {
  booster_tvc: {
    id: 'booster_tvc',
    name: 'Orbital Booster TVC (Falcon/Starship)',
    category: 'Aerospace',
    tagline: 'Rocket landing booster with gimbaled thrust vector control against wind shear',
    description:
      'Gimbaled rocket engine nozzle actively rotates up to ±8° to steer the thrust vector, counteracting aerodynamic atmospheric buffeting during vertical propulsive landing.',
    actuatorType: 'Hydraulic Gimbal Vectoring (u)',
    stateLabels: ['Lateral Drift x', 'Lateral Velocity v', 'Booster Tilt θ', 'Pitch Rate ω'],
    stateUnits: ['m', 'm/s', 'rad', 'rad/s'],
    actuatorUnit: 'kN Thrust Vector',
    keyMetricLabel: 'Touchdown Landing Error',
    recommendedQ: [20, 2, 150, 15],
    recommendedR: 0.05,
    disturbanceLabel: 'Atmospheric Wind Shear (+15kN)',
    disturbanceMagnitude: 15.0
  },
  gantry_crane: {
    id: 'gantry_crane',
    name: 'Harbor Gantry Crane Anti-Sway',
    category: 'Industrial Robotics',
    tagline: 'Automated container hoist with active trolley acceleration to cancel sway',
    description:
      'High-speed intermodal harbor crane uses predictive trolley acceleration to eliminate heavy shipping container pendulation during high-throughput maritime port operations.',
    actuatorType: 'Trolley Rail Motor (u)',
    stateLabels: ['Trolley Position x', 'Trolley Speed v', 'Cable Sway Angle θ', 'Sway Velocity ω'],
    stateUnits: ['m', 'm/s', 'rad', 'rad/s'],
    actuatorUnit: 'kN Rail Force',
    keyMetricLabel: 'Residual Sway Angle',
    recommendedQ: [10, 5, 200, 25],
    recommendedR: 0.2,
    disturbanceLabel: 'Sudden Gust on Container (+12kN)',
    disturbanceMagnitude: 12.0
  },
  robotic_joint: {
    id: 'robotic_joint',
    name: 'Biomechanical Prosthetic Knee',
    category: 'Biomedical',
    tagline: 'Active powered prosthetic joint with variable impedance damping',
    description:
      'Microprocessor-controlled knee joint with brushless direct-drive torque motor providing variable mechanical impedance matching human gait kinematics.',
    actuatorType: 'Brushless BLDC Actuator (τ)',
    stateLabels: ['Limb Displacement x', 'Limb Speed v', 'Joint Angle θ', 'Joint Velocity ω'],
    stateUnits: ['deg', 'deg/s', 'rad', 'rad/s'],
    actuatorUnit: 'N·m Joint Torque',
    keyMetricLabel: 'Kinematic Tracking Error',
    recommendedQ: [15, 1, 80, 8],
    recommendedR: 0.1,
    disturbanceLabel: 'Heel Strike Impact (+8N·m)',
    disturbanceMagnitude: 8.0
  },
  cart_pole: {
    id: 'cart_pole',
    name: 'Inverted Cart-Pole Benchmark',
    category: 'Classical Benchmark',
    tagline: 'The canonical underactuated mechanical benchmark for optimal control',
    description:
      'Rigid pole hinged to a motorized cart moving horizontally on a linear track, stabilized via continuous-time CARE LQR state feedback.',
    actuatorType: 'Linear Belt Actuator (u)',
    stateLabels: ['Cart Position x', 'Cart Velocity v', 'Pole Tilt Angle θ', 'Angular Velocity ω'],
    stateUnits: ['m', 'm/s', 'rad', 'rad/s'],
    actuatorUnit: 'N Actuator Force',
    keyMetricLabel: 'Upright Stabilization Time',
    recommendedQ: [10, 1, 100, 10],
    recommendedR: 0.1,
    disturbanceLabel: 'Track Impulse Disturbance (+10N)',
    disturbanceMagnitude: 10.0
  },
  double_pendulum: {
    id: 'double_pendulum',
    name: 'Coupled Chaos Dual-Link Arm',
    category: 'Classical Benchmark',
    tagline: 'Multi-body non-linear robotic arm exhibiting deterministic chaos',
    description:
      'Two coupled links exhibiting extreme sensitivity to initial conditions (Lyapunov exponent λ > 0) and energy-conserving Hamiltonian phase divergence.',
    actuatorType: 'Dual Passive Linkage',
    stateLabels: ['Link 1 Angle θ₁', 'Link 1 Speed ω₁', 'Link 2 Angle θ₂', 'Link 2 Speed ω₂'],
    stateUnits: ['rad', 'rad/s', 'rad', 'rad/s'],
    actuatorUnit: 'Unactuated (Passive)',
    keyMetricLabel: 'Lyapunov Divergence',
    recommendedQ: [0, 0, 0, 0],
    recommendedR: 1.0,
    disturbanceLabel: 'Tip Bob Flick (+5 rad/s)',
    disturbanceMagnitude: 5.0
  },
  single_pendulum: {
    id: 'single_pendulum',
    name: 'Laboratory Optical Motion Twin',
    category: 'Classical Benchmark',
    tagline: 'Precision optical kinematics extracted via Meta SAM 3.1 & circle-fit',
    description:
      'High-precision optical calibration reference using sub-pixel Pratt circle fitting and deterministic Runge-Kutta 4 holdout validation.',
    actuatorType: 'Natural Gravity & Damping',
    stateLabels: ['Angle θ', 'Angular Velocity ω', 'Angular Accel α', 'Total Energy H'],
    stateUnits: ['rad', 'rad/s', 'rad/s²', 'Joules'],
    actuatorUnit: 'Free Oscillation',
    keyMetricLabel: 'Holdout Validation RMSE',
    recommendedQ: [0, 0, 0, 0],
    recommendedR: 1.0,
    disturbanceLabel: 'Angle Deflection (+30°)',
    disturbanceMagnitude: 30.0
  }
};

