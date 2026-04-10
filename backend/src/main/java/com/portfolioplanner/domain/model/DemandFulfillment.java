package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "demand_fulfillments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DemandFulfillment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "demand_request_id", nullable = false)
    private Long demandRequestId;

    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    @Column(name = "allocation_id")
    private Long allocationId;

    @Column(name = "fulfilled_at", nullable = false)
    private LocalDateTime fulfilledAt;
}
