import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// The site the app opens. Override for testing, e.g. ./gradlew installDebug -PdrivexUrl=http://10.0.2.2:9291
val drivexUrl = (findProperty("drivexUrl") as String?) ?: "https://drivex-customer.vercel.app"

// Release signing comes from keystore.properties (not committed); without it the release build is unsigned.
val keystore = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.drivex.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.drivex.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "START_URL", "\"$drivexUrl\"")
        resourceConfigurations += listOf("en", "fa", "ar")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (keystore.isNotEmpty()) create("release") {
            storeFile = rootProject.file(keystore.getProperty("storeFile"))
            storePassword = keystore.getProperty("storePassword")
            keyAlias = keystore.getProperty("keyAlias")
            keyPassword = keystore.getProperty("keyPassword")
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

// APK names with the version: Drivex-1.0.0.apk (release), Drivex-1.0.0-debug.apk
@Suppress("DEPRECATION")
android.applicationVariants.configureEach {
    outputs.configureEach {
        (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName =
            "Drivex-${versionName}.apk"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.browser)
    testImplementation(libs.junit)
}
