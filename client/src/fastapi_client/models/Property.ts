/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Property performance data - optimized for display.
 */
export type Property = {
    id: string;
    name: string;
    city: string;
    property_type: (string | null);
    views: number;
    bookings: number;
    initiation_rate: number;
    completion_rate: number;
    cancel_rate: number;
    payment_fail_rate: number;
    avg_review_rating: (number | null);
    revenue: number;
    bucket: string;
};

