package com.portfolioplanner.domain.model.enums;

import lombok.Getter;

@Getter
public enum TshirtSize {
    XS(40),
    S(80),
    M(160),
    L(320),
    XL(600);

    private final int baseHours;

    TshirtSize(int baseHours) {
        this.baseHours = baseHours;
    }
}
