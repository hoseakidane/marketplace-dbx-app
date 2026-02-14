/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DeviceDiagnosis } from './DeviceDiagnosis';
import type { DeviceFunnel } from './DeviceFunnel';
import type { WeeklyTrend } from './WeeklyTrend';
/**
 * Response for device metrics endpoint.
 */
export type DeviceMetricsResponse = {
    city: string;
    deviceFunnel: Record<string, DeviceFunnel>;
    weeklyTrends: Array<WeeklyTrend>;
    diagnosis: DeviceDiagnosis;
};

