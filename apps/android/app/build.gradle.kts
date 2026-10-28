import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

fun props(name: String) = Properties().apply {
    val f = rootProject.file(name)
    if (f.exists()) f.inputStream().use { load(it) }
}

// The Supabase project and its public (anon) key: the site's VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// They come from secrets.properties (not committed, see secrets.properties.example) or -P flags.
val secrets = props("secrets.properties")
fun secret(key: String) = (findProperty(key) as String?) ?: secrets.getProperty(key) ?: ""

// Release signing comes from keystore.properties (not committed); without it the release build is unsigned.
val keystore = props("keystore.properties")

android {
    namespace = "com.drivex.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.drivex.app"
        minSdk = 26
        targetSdk = 35
        // 1.x was the site in a web view; 2.0 is the native app. It installs over 1.x (same id and key).
        versionCode = 2
        versionName = "2.0.0"
        buildConfigField("String", "SITE_URL", "\"${secret("drivexUrl").ifEmpty { "https://drivex-customer.vercel.app" }}\"")
        buildConfigField("String", "SUPABASE_URL", "\"${secret("supabaseUrl")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${secret("supabaseAnonKey")}\"")
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
    buildFeatures {
        buildConfig = true
        compose = true
    }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    testOptions.unitTests {
        isIncludeAndroidResources = true
        all { it.systemProperty("drivex.screens", if (project.hasProperty("screens")) "true" else "false") }
    }
}

// APK names with the version: Drivex-2.0.0.apk (release), Drivex-2.0.0-debug.apk
@Suppress("DEPRECATION")
android.applicationVariants.configureEach {
    outputs.configureEach {
        (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName = "Drivex-${versionName}.apk"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.process)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.androidx.exifinterface)
    testImplementation(libs.junit)
    // screen pictures rendered on the computer (ScreensTest): ./gradlew testDebugUnitTest -Pscreens
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
