// Stub module to replace chart-container during server-side builds
// This prevents 'self is not defined' errors by ensuring the chart component
// is never executed on the server
'use client'

import React from 'react'

export function ChartContainer(_props: any) {
  return null;
}

export default ChartContainer;
