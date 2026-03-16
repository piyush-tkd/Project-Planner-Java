package com.portfolioplanner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class PortfolioPlannerApplication {
    public static void main(String[] args) {
        SpringApplication.run(PortfolioPlannerApplication.class, args);
    }
}
